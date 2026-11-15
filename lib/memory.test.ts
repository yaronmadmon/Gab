import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOps, comingUp, memoryForCoach, parseOps, recentTurns, undoChange, whenLabel, type Person } from './memory.ts';

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

test('when labels read naturally', () => {
  assert.equal(whenLabel(0), 'Today');
  assert.equal(whenLabel(1), 'Tomorrow');
  assert.equal(whenLabel(5), 'In 5 days');
  assert.equal(whenLabel(-3), '3 days ago · ask how it went');
});
