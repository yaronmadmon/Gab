import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOf, applyOps, chatsAbout, goalsFor, comingUp, memoryForCoach, parseOps, recentTurns, undoChange, whenLabel, type Person } from './memory.ts';

test('parseOps drops bad changes from the AI', () => {
  const ops = parseOps([
    { type: 'add_fact', person: 'David', text: "Son's wedding", date: '2026-12-10' },
    { type: 'add_fact', person: 'David', text: 'Bad date', date: 'next month' },
    { type: 'set_goal', person: 'David', goal: 'marry' },
    { type: 'delete_everything' },
    { type: 'add_fact', person: '', text: 'no name' },
    'junk',
  ]);
  assert.deepEqual(ops, [
    { type: 'add_fact', person: 'David', text: "Son's wedding", date: '2026-12-10' },
    { type: 'add_fact', person: 'David', text: 'Bad date', date: undefined },
  ]);
});

test('a fact about a new person adds the person once', () => {
  const { people, changes } = applyOps([], parseOps([
    { type: 'add_fact', person: 'David', text: 'Loves fishing' },
    { type: 'add_fact', person: 'david', text: 'Works at the bank' },
  ]));
  assert.equal(people.length, 1);
  assert.equal(people[0].facts.length, 2);
  assert.deepEqual(changes.map(c => c.kind), ['person', 'fact', 'fact']);
});

test('the same fact is not saved twice', () => {
  const first = applyOps([], [{ type: 'add_fact', person: 'Dana', text: 'Has a dog' }]);
  const second = applyOps(first.people, [{ type: 'add_fact', person: 'Dana', text: 'has a dog' }]);
  assert.equal(second.people[0].facts.length, 1);
  assert.equal(second.changes.length, 0);
});

test('undo removes a saved fact, and a person Gab added with it', () => {
  const { people, changes } = applyOps([], [{ type: 'add_fact', person: 'Eli', text: 'Moving in March' }]);
  const factUndone = undoChange(people, changes[1]);
  assert.equal(factUndone[0].facts.length, 0);
  assert.equal(undoChange(people, changes[0], changes).length, 0);
});

test('undoing "Added David" keeps facts saved about him later', () => {
  const first = applyOps([], [{ type: 'add_person', name: 'David' }]);
  const later = applyOps(first.people, [{ type: 'add_fact', person: 'David', text: "Son's wedding" }]);
  const after = undoChange(later.people, first.changes[0], first.changes);
  assert.equal(after.length, 1);
  assert.equal(after[0].facts.length, 1);
});

test('recent turns always start with the user', () => {
  const msgs = Array.from({ length: 45 }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', content: `m${i}` }));
  const recent = recentTurns(msgs);
  assert.equal(recent[0].role, 'user');
  assert.equal(recent.at(-1)?.content, 'm44');
  assert.ok(recent.length <= 40);
});

test('private notes are marked for the coach', () => {
  const text = memoryForCoach([{ id: 'p', name: 'Dana', where: '', goal: 'unsure', facts: [{ id: 'f', text: 'Father is sick', createdAt: '', private: true }] }]);
  assert.match(text, /PRIVATE/);
});

test('coming up keeps a week back to two weeks ahead, by calendar day', () => {
  const person: Person = { id: 'p', name: 'David', where: '', goal: 'friendly', facts: [
    { id: 'a', text: 'Wedding', date: '2026-11-25', createdAt: '' },
    { id: 'b', text: 'Surgery', date: '2026-11-13', createdAt: '' },
    { id: 'c', text: 'Too far', date: '2026-12-15', createdAt: '' },
    { id: 'd', text: 'Long ago', date: '2026-11-01', createdAt: '' },
    { id: 'e', text: 'No date', createdAt: '' },
  ] };
  const items = comingUp([person], '2026-11-15');
  assert.deepEqual(items.map(i => [i.fact.text, i.days]), [['Surgery', -2], ['Wedding', 10]]);
});

test('coming up does not drift across a daylight saving change', () => {
  const person: Person = { id: 'p', name: 'A', where: '', goal: 'unsure', facts: [{ id: 'a', text: 'x', date: '2026-11-02', createdAt: '' }] };
  assert.equal(comingUp([person], '2026-10-31')[0].days, 2);
});

test('Gab adds to the story and never wipes what the user wrote', () => {
  const start: Person[] = [{ id: 'p', name: 'David', where: '', goal: 'unsure', facts: [], history: 'We met at synagogue years ago.' }];
  const { people, changes } = applyOps(start, parseOps([
    { type: 'add_history', person: 'David', text: 'We argued about the building fund last year.' },
    { type: 'set_wish', person: 'David', text: 'I want things easy between us again.' },
  ]));
  assert.equal(people[0].history, 'We met at synagogue years ago.\n\nWe argued about the building fund last year.');
  assert.equal(people[0].wish, 'I want things easy between us again.');
  assert.deepEqual(changes.map(c => c.kind), ['history', 'wish']);
  const undone = undoChange(undoChange(people, changes[0]), changes[1]);
  assert.equal(undone[0].history, 'We met at synagogue years ago.');
  assert.equal(undone[0].wish, undefined);
});

test('the same story line is not added twice', () => {
  const first = applyOps([], [{ type: 'add_history', person: 'Dana', text: 'Old school friend' }]);
  const second = applyOps(first.people, [{ type: 'add_history', person: 'Dana', text: 'old school friend' }]);
  assert.equal(second.changes.length, 0);
});

test('undoing a new person from an interview removes their story too', () => {
  const { people, changes } = applyOps([], parseOps([
    { type: 'add_person', person: 'Eli' },
    { type: 'add_history', person: 'Eli', text: 'Neighbor since 2019' },
    { type: 'set_wish', person: 'Eli', text: 'Stay friendly' },
  ]));
  let after = people;
  for (const c of changes) after = undoChange(after, c, changes);
  assert.equal(after.length, 0);
});

test('the coach sees the story and the wish', () => {
  const text = memoryForCoach([{ id: 'p', name: 'Dana', where: 'work', goal: 'closer', facts: [], history: 'Started the same week.\nLunch sometimes.', wish: 'Become real friends' }]);
  assert.match(text, /in their words: Become real friends/);
  assert.match(text, /History: Started the same week\. Lunch sometimes\./);
});

test('chats about a person include ones that saved something about them', () => {
  const chats = [
    { id: 'a', title: '', updatedAt: '', messages: [], saved: [], personId: 'p' },
    { id: 'b', title: '', updatedAt: '', messages: [], saved: [{ afterMessage: 0, changes: [{ kind: 'fact' as const, personId: 'p', label: '' }] }] },
    { id: 'c', title: '', updatedAt: '', messages: [], saved: [] },
  ];
  assert.deepEqual(chatsAbout(chats, 'p').map(c => c.id), ['a', 'b']);
});

test('when labels read naturally', () => {
  assert.equal(whenLabel(0), 'Today');
  assert.equal(whenLabel(1), 'Tomorrow');
  assert.equal(whenLabel(5), 'In 5 days');
  assert.equal(whenLabel(-3), '3 days ago · ask how it went');
});

test('who they are is saved, and a goal that does not fit is not kept', () => {
  const { people, changes } = applyOps([], parseOps([
    { type: 'add_person', person: 'Noa', relationship: 'child', goal: 'avoid' },
    { type: 'set_age', person: 'Noa', age: 9 },
    { type: 'set_relationship', person: 'Noa', relationship: 'banana' },
  ]), new Date('2026-11-16T12:00:00'));
  assert.equal(people[0].relationship, 'child');
  assert.equal(people[0].goal, 'closer');
  assert.equal(ageOf(people[0], new Date('2026-11-16T12:00:00')), 9);
  assert.deepEqual(changes.map(c => c.kind), ['person', 'age']);
});

test('Gab cannot set "stay away" for a spouse', () => {
  const start: Person[] = [{ id: 'p', name: 'Sarah', where: '', goal: 'closer', facts: [], relationship: 'spouse' }];
  const { people, changes } = applyOps(start, parseOps([{ type: 'set_goal', person: 'Sarah', goal: 'avoid' }]));
  assert.equal(people[0].goal, 'closer');
  assert.equal(changes.length, 0);
  assert.ok(!goalsFor('child').includes('avoid'));
  assert.ok(goalsFor('neighbor').includes('avoid'));
});

test('changing who someone is keeps a goal that still fits', () => {
  const start: Person[] = [{ id: 'p', name: 'Mark', where: '', goal: 'distance', facts: [] }];
  const { people } = applyOps(start, parseOps([{ type: 'set_relationship', person: 'Mark', relationship: 'boss' }]));
  assert.equal(people[0].relationship, 'boss');
  assert.equal(people[0].goal, 'distance');
});

test('the coach sees who they are and their age', () => {
  const text = memoryForCoach([{ id: 'p', name: 'Eli', where: '', goal: 'closer', facts: [], relationship: 'child', birthYear: 2010 }], new Date('2026-11-16T12:00:00'));
  assert.match(text, /who: My child \| age: about 16/);
  assert.match(memoryForCoach([{ id: 'q', name: 'X', where: '', goal: 'unsure', facts: [] }]), /who: not set/);
});
