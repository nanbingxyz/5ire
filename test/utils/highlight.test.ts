/**
 * @jest-environment jsdom
 */
import { describe, expect, test } from "@jest/globals";
import { highlight } from "../../src/utils/util";

describe("highlight", () => {
  test("marks a plain keyword, ignoring case", () => {
    expect(highlight("Hello World", "world")).toEqual("Hello <mark>World</mark>");
  });

  test("treats the keyword as text, not as a regular expression", () => {
    // these used to throw "Invalid regular expression"
    expect(highlight("I like C++ and C#", "c++")).toEqual("I like <mark>C++</mark> and C#");
    expect(highlight("call f(x) now", "f(")).toEqual("call <mark>f(</mark>x) now");
    expect(highlight("arr[0] = 1", "[0")).toEqual("arr<mark>[0</mark>] = 1");
    expect(highlight("a*b", "*")).toEqual("a<mark>*</mark>b");
    // these used to match more than the typed text
    expect(highlight("v1.2 and v1x2", "1.2")).toEqual("v<mark>1.2</mark> and v1x2");
    expect(highlight("a|b c", "a|b")).toEqual("<mark>a|b</mark> c");
  });

  test("marks each word of a keyword list as text", () => {
    expect(highlight("C++ and (x)", ["c++", "(x)"])).toEqual("<mark>C++</mark> and <mark>(x)</mark>");
  });
});
