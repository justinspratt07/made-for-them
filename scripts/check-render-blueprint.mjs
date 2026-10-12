import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

try {
  const blueprint = yaml.load(await readFile("render.yaml", "utf8"));
  const response = await fetch("https://render.com/schema/render.yaml.json", { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Schema is unavailable.");
  const schema = await response.json();
  const validator = new Ajv2020({ allErrors: true, strict: false });
  addFormats(validator);
  const validate = validator.compile(schema);
  if (!validate(blueprint)) {
    console.error("Render Blueprint schema validation failed.");
    for (const error of validate.errors ?? []) console.error(`${error.instancePath}: ${error.message}`);
    process.exitCode = 1;
  } else console.log("Render Blueprint schema validation passed; no account access or deployment performed.");
} catch {
  console.error("Render Blueprint validation could not complete. Check the public schema and configuration.");
  process.exitCode = 1;
}
