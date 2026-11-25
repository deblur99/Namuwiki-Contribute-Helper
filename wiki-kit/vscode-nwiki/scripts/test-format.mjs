import assert from "node:assert/strict";
import { explodeGluedTags, formatNwiki } from "../out/formatCore.js";

const input = `<template>
  <Heading title="여담">
    <Quote>
      <Text
        text="a"
        weight=.medium
        />
        <Text
          text="b"
          decoration=[.italic]
          />
          <Text
            text="c"
            />
          </Quote>
        </Heading>
      </template>
`;

const out = formatNwiki(input);
const expected = `<template>
  <Heading title="여담">
    <Quote>
      <Text
        text="a"
        weight=.medium
      />
      <Text
        text="b"
        decoration=[.italic]
      />
      <Text
        text="c"
      />
    </Quote>
  </Heading>
</template>
`;

assert.equal(out.replace(/\n+$/, "\n"), expected);

const withOpenAngle = formatNwiki(`<Folding
  title="x"
>
  <Text text="y" />
</Folding>
`);
assert.equal(
  withOpenAngle.replace(/\n+$/, "\n"),
  `<Folding
  title="x"
>
  <Text text="y" />
</Folding>
`
);

assert.deepEqual(explodeGluedTags('/><Text'), ["/>", "<Text"]);
assert.deepEqual(explodeGluedTags('</Quote><Text'), ["</Quote>", "<Text"]);
assert.deepEqual(
  explodeGluedTags('<Text text="a>b" /><Text'),
  ['<Text text="a>b" />', "<Text"]
);

const glued = formatNwiki(`<Quote>
  <Text
    text="a"
    /><Text
    text="b"
  />
</Quote>
`);
assert.equal(
  glued.replace(/\n+$/, "\n"),
  `<Quote>
  <Text
    text="a"
  />
  <Text
    text="b"
  />
</Quote>
`
);

console.log("format fixtures ok");
