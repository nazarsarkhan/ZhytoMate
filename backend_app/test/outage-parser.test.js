import test from "node:test";
import assert from "node:assert/strict";
import { findAddressInParsedPage, parseZtoePage } from "../src/features/outage/provider/ztoe.parser.js";

const page = `
<body>
  <h3>На 17.07.2026 команди НЕК УКРЕНЕРГО на застосування графіків погодинних відключень електроенергії на Житомирщині не надходило.</h3>
  <table>
    <tr><td>РЕМ</td><td>Населений пункт</td><td>Назва вулиці, провулка, тощо</td><td>Будинки</td><td>Черга</td><td>Підчерга</td><td>Примітка</td></tr>
    <tr><td>Житомирський</td><td>місто Житомир</td><td>вул. Вільський Шлях</td><td>14, 15</td><td>5</td><td>2</td><td>побутові споживачі</td></tr>
    <tr><td>Житомирський</td><td>місто Житомир</td><td>вул. Вільський Шлях</td><td>14</td><td>5</td><td>2</td><td>непобутові (юридичні) споживачі</td></tr>
  </table>
  <table>
    <tr><td></td><td>00:00-00:30</td><td>00:30-01:00</td></tr>
    <tr><td>5.2</td><td style="background: #ffffff"></td><td style="background: #ff0000"></td></tr>
  </table>
</body>`;

test("parses ZTOE address and schedule rows", () => {
  const parsed = parseZtoePage(page, 10);

  assert.equal(parsed.date, "2026-07-17");
  assert.equal(parsed.hasActiveCommand, false);
  assert.equal(parsed.addresses.length, 2);
  assert.equal(parsed.schedules.length, 1);
  assert.deepEqual(parsed.schedules[0].slots, [
    { from: "00:00", to: "00:30", status: "on" },
    { from: "00:30", to: "01:00", status: "off" },
  ]);

  assert.deepEqual(
    findAddressInParsedPage(parsed, {
      city: "Житомир",
      street: "вулиця Вільський Шлях",
      building: "14",
    }),
    parsed.addresses[0],
  );

  assert.deepEqual(
    findAddressInParsedPage(parsed, {
      city: "Житомир",
      street: "вулиця Вільський Шлях",
      building: "14, к.1.2,3",
    }),
    parsed.addresses[0],
  );
});
