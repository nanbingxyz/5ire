import { describe, expect, test } from '@jest/globals';
import { IPromptDef } from '../../src/intellichat/types';
import {
  fillVariables,
  parseVariables,
  sortPrompts,
  transformPropertiesType,
} from '../../src/utils/util';
import exp from 'constants';

describe('utils/util', () => {
  test('parseVariables', () => {
    const str1 = 'hello {{name}}';
    const str2 = 'hello {{name}} {{age}}';
    const variables1 = parseVariables(str1);
    expect(variables1).toEqual(['name']);
    const variables2 = parseVariables(str2);
    expect(variables2).toEqual(['name', 'age']);
    const str3 = 'hello {{name}} {{age';
    const variables3 = parseVariables(str3);
    expect(variables3).toEqual(['name']);
    const str4 = 'hello {{}}';
    const variables4 = parseVariables(str4);
    expect(variables4).toEqual([]);
    const str5 = 'hello {{        }}';
    const variables5 = parseVariables(str5);
    expect(variables5).toEqual([]);
    const str6 = 'hello {{   name     }}';
    const variables6 = parseVariables(str6);
    expect(variables6).toEqual(['name']);
    const str7 = 'hello {{   name     }} {{age}} {{name}}';
    const variables7 = parseVariables(str7);
    expect(variables7).toEqual(['name', 'age']);
  });

  // eslint-disable-next-line jest/expect-expect
  test('sortPrompts', () => {
    const prompts = [
      {
        id: '1',
        name: 'Cras justo odio',
        systemMessage: 'Curabitur blandit tempus porttitor.',
        userMessage: 'Fermentum Porta',
        pinedAt: null,
        updatedAt: 1691759611,
        createdAt: 1691759611,
      },
      {
        id: '2',
        name: 'Venenatis Ullamcorper',
        systemMessage: 'Aenean lacinia bibendum nulla sed consectetur.',
        userMessage: 'Curabitur blandit tempus porttitor.',
        pinedAt: 1692084097,
        updatedAt: 1691759621,
        createdAt: 1691759621,
      },
      {
        id: '3',
        name: 'Ligula Pellentesque Ullamcorper',
        systemMessage:
          'Maecenas sed diam eget risus varius blandit sit amet non magna.',
        userMessage:
          'Praesent commodo cursus magna, vel scelerisque nisl consectetur et.',
        pinedAt: 1692084087,
        updatedAt: 1691759631,
        createdAt: 1691759631,
      },
      {
        id: '4',
        name: 'Tortor Nullam',
        systemMessage:
          'Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.',
        userMessage: 'Nulla vitae elit libero, a pharetra augue.',
        pinedAt: null,
        updatedAt: 1691759641,
        createdAt: 1691759641,
      },
    ] as IPromptDef[];
    const sorted = sortPrompts(prompts).map((i) => i.id);
    expect(sorted).toEqual(['2', '3', '1', '4']);
  });

  test('fillVariables', () => {
    const txt1 = 'Hi, {{name}}, Nice to meet you!';
    expect('Hi, John, Nice to meet you!').toEqual(
      fillVariables(txt1, { name: 'John' }),
    );
    const txt2 = 'Hi, {{name}}, you are {{age}} years old.';
    expect('Hi, John, you are 20 years old.').toEqual(
      fillVariables(txt2, { name: 'John', age: '20' }),
    );
    const txt3 = 'Hi, {{name}}, My name is also {{name}}';
    expect('Hi, John, My name is also John').toEqual(
      fillVariables(txt3, { name: 'John' }),
    );
  });

  test('fillVariables fills the names parseVariables returns', () => {
    // padded names, as in the parseVariables test
    expect(fillVariables('Hi {{   name     }}', { name: 'John' })).toEqual(
      'Hi John',
    );
    // names with regex characters
    expect(fillVariables('Use {{c++ code}}', { 'c++ code': 'C' })).toEqual(
      'Use C',
    );
    expect(
      fillVariables('Lang {{lang (optional)}}', { 'lang (optional)': 'fr' }),
    ).toEqual('Lang fr');
    // values are inserted as typed, not as replace() patterns
    expect(fillVariables('Cost {{c}}', { c: "$$5 $& $'" })).toEqual(
      "Cost $$5 $& $'",
    );
    // a value that looks like another placeholder is not filled again
    expect(fillVariables('{{a}} {{b}}', { a: '{{b}}', b: 'B' })).toEqual(
      '{{b}} B',
    );
    // names without a value stay as they are
    expect(fillVariables('{{a}} {{b}}', { a: 'A' })).toEqual('A {{b}}');
    // a triple brace is read the way parseVariables reads it
    expect(parseVariables('x {{{n}}} y')).toEqual(['{n']);
    expect(fillVariables('x {{{n}}} y', { '{n': 'V' })).toEqual('x V} y');
  });

  test('transformPropertiesType', () => {
    const input = {
      properties: {
        name: {
          type: ['string', null, 'text'],
          other: 'value',
        },
        age: {
          type: ['number', 'null'],
          other: 'value',
        },
        other: {
          properties: {
            nested: {
              type: ['boolean', null],
            },
          },
        },
      },
      otherProps: {
        properties: {
          nested: {
            type: ['boolean', null],
          },
        },
      },
    };
    expect(transformPropertiesType(input)).toEqual({
      properties: {
        name: {
          type: 'string',
          other: 'value',
        },
        age: {
          type: 'number',
          other: 'value',
        },
        other: {
          properties: {
            nested: {
              type: 'boolean',
            },
          },
        },
      },
      otherProps: {
        properties: {
          nested: {
            type: 'boolean',
          },
        },
      },
    });
  });
});
