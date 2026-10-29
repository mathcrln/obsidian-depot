# Object references

An object reference is how a note stores an attachment in object storage: the identity of the object, never a way to access it.

## Format

- [ ] `REF-006` An object reference has the form `<profile>://<object-key>`.
- [ ] `REF-001` An object reference permanently identifies one storage profile and one object key.
- [ ] `REF-007` Object keys containing characters that are not valid in a Markdown link destination are percent-encoded in the reference and decode to the original key.
- [ ] `REF-008` An object reference can be used as an embed (`![](…)`) or as a link (`[…](…)`).
- [?] `REF-009` Profile schemes in references match profile identifiers case-insensitively.

## Contents

- [ ] `REF-002` An object reference contains no access credentials.
- [ ] `REF-003` An object reference contains no presigned URL or other expiring access token.

## Stability

- [ ] `REF-004` Changing a profile's endpoint, bucket, region, or credentials does not require changing references in notes.
- [ ] `REF-010` A reference to a deleted storage profile is shown as a visible failure.
- [ ] `REF-005` A reference whose profile cannot be reached is shown as a visible failure.
- [ ] `REF-012` A link whose scheme has never been a storage profile identifier is left untouched.
- [ ] `REF-011` A failing reference is never rewritten in the note.
