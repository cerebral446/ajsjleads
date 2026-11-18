import assert from "node:assert/strict";
import test from "node:test";
import { importEvidence, regionalize, score } from "../src/lib/discovery/model";
import { parseDirectory, seeds } from "../src/lib/discovery/sources";

test("accepts Southeast Georgia and keeps uncertain locations for review", () => {
  assert.equal(regionalize({ zip: "31558" }, 75).region, "qualified");
  assert.equal(regionalize({ zip: "33101" }, 75).region, "outside");
  assert.equal(regionalize({ city: "Unknown", state: "GA" }, 75).region, "uncertain");
  assert.equal(regionalize({ zip: "31558" }, 10).region, "outside");
});

test("category listings are observations, with no inferred builder or contact verification", () => {
  const url = "https://members.nefba.com/directory/Search/example";
  const body = '<h4>Results: 1</h4><div class="mn-row-inner"><a class="mn-main-heading" href="/directory/Details/example">Example</a><a href="tel:9045550100">(904) 555-0100</a><span class="mn-zip">32202</span></div>';
  const result = parseDirectory(body, url, "Multifamily", 75);
  assert.equal(result.count, 1);
  assert.equal(result.rows[0].data.phone, "(904) 555-0100");
  assert.equal(result.rows[0].data.classification, undefined);
  assert.equal(result.rows[0].data.phoneConfirmed, undefined);
  assert.throws(() => parseDirectory(body.replace("Results: 1", "Results: 2"), url, "Multifamily", 75), /2 listings/);
  assert.equal(seeds().length, 16);
  assert.ok(seeds().every((seed) => seed.source.checkedAt === null && !seed.data.phoneConfirmed));
});

test("applies only supplied corroboration and date-sensitive construction scoring", () => {
  const [observation] = importEvidence([{
    name: "Example", sourceType: "Permitting", sourceUrl: "https://example.org/permits/1", checkedAt: "2026-01-01",
    city: "Jacksonville", state: "FL", zip: "32202", construction: "Exterior work in progress per permit",
    constructionDate: "2026-01-01", sizeEvidence: "Published staffing report", scope: "Exterior cladding",
    contact: "Example Person", role: "Manager", classification: "builder", pinnacleEvidence: "Unsupported claim",
  }], 75);
  assert.equal(observation.data.contact, undefined);
  assert.equal(observation.data.pinnacleEvidence, undefined);
  assert.equal(observation.data.classification, undefined);
  assert.equal(score(observation.data, Date.parse("2026-10-01")).total, 90);
  assert.equal(score(observation.data, Date.parse("2027-10-01")).total, 65);
  assert.throws(() => importEvidence([{ name: "Example", sourceType: "NEFBA", sourceUrl: "javascript:alert(1)", checkedAt: "2026-01-01" }], 75));
});
