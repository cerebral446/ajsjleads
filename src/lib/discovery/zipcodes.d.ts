declare module "zipcodes" {
  type Point = { latitude: number; longitude: number };
  const zipcodes: { lookup(zip: string): Point | undefined; lookupByName(city: string, state: string): Point[] };
  export default zipcodes;
}
