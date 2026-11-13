import assert from "node:assert/strict";
import { test } from "node:test";
import { current, phrases } from "./captions";

test("decimals, amounts and abbreviations never split a sentence", () => {
  const t = "Tu efectivo cubre 3.2 meses. Son $113,300 para la casa.";
  assert.deepEqual(
    phrases(t).map((p) => p.text.trim()),
    ["Tu efectivo cubre 3.2 meses.", "Son $113,300 para la casa."],
  );
});

test("a sentence still arriving without its full stop is kept", () => {
  assert.deepEqual(
    phrases("Hola Michael. Soy Cordada, la guía que").map((p) => p.text.trim()),
    ["Hola Michael.", "Soy Cordada, la guía que"],
  );
});

test("long sentences are cut at commas, then by words, and every phrase fits", () => {
  const t =
    "Lo que más destaca en tu plan es el dinero para la casa, porque la entrada de ciento trece mil dólares sale casi toda de tus inversiones, y eso reduce lo que tendrás cuando dejes de trabajar a los cincuenta y ocho años según la proyección del plan que ha preparado tu asesor.";
  const ps = phrases(t);
  assert.ok(ps.length >= 3);
  assert.ok(ps.every((p) => p.text.trim().length <= 110), ps.map((p) => p.text.length).join(","));
  assert.equal(ps.map((p) => p.text).join(""), t, "phrases cover the text exactly, in order");
});

test("positions follow the voice: words light as the voice reaches them", () => {
  const t = "Hola Michael. Vamos a ver tu plan.";
  assert.equal(current(t, 0)!.said, 0);
  assert.equal(current(t, 1)!.said, 1);
  assert.equal(current(t, 6)!.said, 2);
  const second = current(t, 15)!;
  assert.equal(second.phrase.text.trim(), "Vamos a ver tu plan.");
  assert.equal(second.said, 1);
});
