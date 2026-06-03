<script lang="ts">
  // Test fixture for `local/no-bash-c-in-template`.
  // This file SHOULD fail lint — it contains a `bash -c` string literal.
  // After fixing (removing the bash -c), the file should pass.

  // VIOLATION: bash -c in a string literal
  const bad1 = 'bash -c "id"';

  // VIOLATION: bash -c in a template literal
  const bad2 = `bash -c "rm -rf /"`;

  // OK: no bash -c here
  const good1 = 'safe command';

  // OK: explicit command primitive (not bash -c)
  const good2 = `id`;
</script>

<p>Violation fixtures. This file should fail lint on the `bad*` lines.</p>
