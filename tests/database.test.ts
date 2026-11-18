import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("discovery migration preserves CRM records and creates one lead per approved candidate", async () => {
  const db = new PGlite();
  try {
    const actor = "10000000-0000-0000-0000-000000000001";
    await db.exec(`
      create role authenticated;
      create role anon;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      insert into auth.users values ('${actor}','reviewer@example.com','{}');
      grant usage on schema auth to authenticated;
      grant select on all tables in schema auth to authenticated;
    `);
    const schema = await readFile("supabase/schema.sql", "utf8");
    const migration = await readFile("supabase/discovery.sql", "utf8");
    await db.exec(schema.replace('create extension if not exists "pgcrypto";', ""));
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`select set_config('request.jwt.claim.sub','${actor}',false)`);
    const id = (await db.query<{ id: string }>("select public.discovery_start('manual') id")).rows[0].id;
    assert.equal((await db.query<{ id: string }>("select public.discovery_start('scheduled') id")).rows[0].id, null);
    await db.exec(`insert into public.leads(company_name,phone,notes,status)
      values ('Current Builder Inc','1 (904) 555-0101','Human notes','do_not_contact')`);
    const source = { name: "Builder website", url: "https://example.com/contact", checkedAt: "2026-01-01" };
    const observation = (name: string, phone: string) => ({
      data: { name, phone, phoneConfirmed: "true", classification: "builder", region: "qualified" },
      category: "Custom Homes", source,
    });
    const ingest = (rows: unknown[]) => db.query("select public.discovery_ingest($1,$2) result", [id, JSON.stringify(rows)]);
    await ingest([observation("Current Builder", "9045550101"), observation("New Builder LLC", "9045550102")]);
    await ingest([{ ...observation("New Builder", "9045550102"), category: "Multifamily" }]);
    const unverified = observation("Unchecked Builder", "9045550103");
    await ingest([{ ...unverified, data: { name: unverified.data.name, phone: unverified.data.phone } }]);
    const candidates = (await db.query<{ id: string; state: string; categories: string[]; name: string }>(
      "select id,state,categories,data->>'name' name from public.discovery_candidates order by name"
    )).rows;
    assert.equal(candidates[0].state, "crm");
    assert.deepEqual(candidates[1].categories, ["Custom Homes", "Multifamily"]);
    const approve = (candidate: string) => db.query<{ lead: string }>("select public.discovery_review($1,'approve') lead", [candidate]);
    await assert.rejects(approve(candidates[2].id), /confirmed regional builder/);
    const lead = (await approve(candidates[1].id)).rows[0].lead;
    assert.equal((await approve(candidates[1].id)).rows[0].lead, lead);
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.leads")).rows[0].n, 2);
    assert.deepEqual((await db.query("select notes,status from public.leads where company_name='Current Builder Inc'")).rows,
      [{ notes: "Human notes", status: "do_not_contact" }]);
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.activities where lead_id=$1", [lead])).rows[0].n, 1);
    await db.exec("reset request.jwt.claim.sub; set role anon");
    await assert.rejects(db.query("select * from public.discovery_candidates"), /permission denied/);
    await assert.rejects(approve(candidates[1].id), /permission denied/);
  } finally {
    await db.close();
  }
});
