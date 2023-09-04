import * as assert from "assert";
import { getNoteMarkerRegex } from "../noteUtil";

suite("noteUtil", function() {
  suite("getNoteMarkerRegex", function() {
    test('produces correct regex', () => {
      assert.equal(
        getNoteMarkerRegex().toString(),
        /note:[A-Za-z0-9]{1,}\s/g.toString()
      );
    });
  });
});