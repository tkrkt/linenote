import { escapeRegex } from '../util';
import * as assert from "assert";

suite("util", function() {
  suite("escapeRegex", function() {
    test('should escape special characters', () => {
      const input = 'Hello [world]';
      const result = escapeRegex(input);
      assert.equal(result, 'Hello \\[world\\]');
    });

    test('should escape period', () => {
      const input = 'Example.com';
      const result = escapeRegex(input);
      assert.equal(result, 'Example\\.com');
    });

    test('should escape multiple special characters in the string', () => {
      const input = 'This is a *test* of $escaping^.';
      const result = escapeRegex(input);
      assert.equal(result, 'This is a \\*test\\* of \\$escaping\\^\\.');
    });

    test('should return an empty string if input is empty', () => {
      const input = '';
      const result = escapeRegex(input);
      assert.equal(result, '');
    });

    test('should handle input with no special characters', () => {
      const input = 'No special characters here';
      const result = escapeRegex(input);
      assert.equal(result, 'No special characters here');
    });
  });
});