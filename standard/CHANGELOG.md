# Changelog

## 2.0

Version 2 is stable. Version 1 files remain valid, and a version 2 reader must
accept them.

One new optional field: `questions.answerWords`, a pair of integers from 0 to
5,000 that says how long the child's own answer must be (the shortest and the
longest), for a writing task. Nothing else changes.

A writer writes the lowest version that holds the file: 2 only when some part
has `answerWords`, otherwise 1. So a file that doesn't use the new field stays
readable by version 1 readers.

The standard also carries `schema/bundle-v2.schema.json` and one valid version 2
example and one refused version 1 file that uses the new field.

## 1.0

First publication. The bundle format, version 1: the file, the fields, the
limits, the identity and update rules, the untrusted-input rules, the
conformance rules, the JSON Schema and two valid examples and two refused
examples.
