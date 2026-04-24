Review an OpenSpec proposal for completeness before implementation.

**Input**: Change name passed as argument (e.g. `/review-proposal my-feature`).

**Steps**

1. Extract the change name from the argument.

2. Check that all required artifacts exist under `openspec/changes/<name>/`:
   - `proposal.md`
   - `design.md`
   - `tasks.md`

   Use the Read or Glob tool to check file existence. Do NOT use Bash for this.

3. **If all files exist:**
   Output: `✓ Proposal <name> is ready for implementation.`
   Exit normally.

4. **If any files are missing:**
   Output: `✗ Proposal <name> is incomplete. Missing files:`
   List each missing file with its full path.
   Then run: `Bash("exit 1")`
