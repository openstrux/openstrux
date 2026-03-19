Review 0.6.0 Changes

More feedback

Regarding benchmarks:
First, we should compare with ts files with 10 relatively simple use-cases to be defined.
Second, once grant-workflow is defined, we should generate Typescript version using the same prompt (except for saying to generate strux instead of direct ts). Measure in and out tokens, but also time.

Regarding grant-workflow:
Read again the usecase requirement file.
We should prepare a repository with specs defining the project: one archived change that generated a completed nextjs front-end calling predefined services and another change defined to generate the back-end, finally another archived change that has generated unit and integration tests (vitest). In another folder, two prompts, one saying to apply change using Nextjs + Prisma, and the other to use strux, with link to strux documentation in the corresponding strux repositories. We should have a few scripts: save result zips the generated back-end files,adds benchmark file + asks for manual input (llm used, manual test results, global result note, feedback) and stores them in results in json file reset should put the repo back in initial state for a new test. A simple page already implemented in front-end allows to navigate between results.

Regarding core-ast:
Is already generated, will have to be completed. In this change, include the review and evolution of the current implementation.

Review all changes to include @types instead of @strux

Review target-ts change with new generator md file in openstrux-spec

---

Consider also this. Should it be an ADR + openstrux-spec update? + use case should follow this implementation.

From a token-optimization perspective, a .strux codebase should be organized so that shared facts live in strux.context files and each panel carries only its unique intent and flow. The docs explicitly recommend context inheritance plus shorthand panel syntax because self-contained panels are much larger than context-driven ones, and the compiled manifest is where full detail belongs.

Core rule
Treat .strux source as the compact authoring form, not the place where every resolved detail is repeated. OpenStrux’s design principle is “source is compact, compiled is complete,” so redundancy should be pushed into the compiled manifest rather than hand-authored files.

File layout
Use a cascade like project-root/strux.context, then domain or team-level strux.context, then small panel.strux files underneath. The inheritance model is explicitly designed so project-wide dp, default access, named source/target, and default ops/sec live in context files while the panel declares only what differs.
​

A good token-efficient pattern is:

Root strux.context for company-wide defaults like controller, DPO, common policies, and named infrastructure endpoints.
​

Domain strux.context for team or product overrides, such as narrower access scope or domain-specific named sources/targets.
​

One panel per use case, with only the business-specific record ID, purpose, predicates, fields, routing, and exceptions.
​

Linking strategy
Prefer named references over repeating inline config. The spec shows that cfg.source production can cost only a few tokens compared with repeating a full inline source definition, while preserving type safety because the resolved type path remains the same after lookup.
​

Link panels through:

Named source and target aliases in context files.
​

Type paths like db.sql.postgres, which are dense and expressive.

Panel-local rod names and implicit chain order, instead of explicit snap wiring everywhere.

Avoid linking by copying full connection blocks, repeated access declarations, or repeated credential definitions into every panel, because the docs call that project-constant repetition and show it materially increases token count.
​

Panel shape
Inside a panel, use shorthand aggressively for the common case. The shorthand proposal removes structural ceremony like rod, drops cfg. and arg. when the rod definition already disambiguates them, and relies on implicit linear chaining so that declaration order becomes the default data flow.

That leads to a preferred authoring pattern:

Declare rods in execution order.

Let the next rod consume the previous rod’s default output unless branching is needed.
​

Use explicit from only for non-default outputs, branches, joins, or merges.
​

Keep access flat and direct where shorthand allows it.
​

The token impact is substantial in the examples: the context-based current syntax is shown at 18 lines and 209 tokens, while the shorthand version drops to 9 lines and 142 tokens.

What not to inherit
Do not try to make everything shared. Certification must not be inherited through context files, and rod logic plus snap wiring remain panel-specific by design.
​

That means the optimized split is:

Inherit organizational defaults: dp, access defaults, named source/target, ops, sec.
​

Keep local and explicit: panel logic, branching, rod-specific arguments, and any cert declarations.
​

Practical template
A token-efficient project should look more like this:

root/strux.context: global dp, baseline access, named infra sources/targets, default ops.
​

pipelines/strux.context: team-level scope narrowing and domain aliases.
​

pipelines/intake/\*.strux: small panels using shorthand, implicit chaining, and source production-style references.

pipelines/eligibility/\*.strux: same pattern, only declaring the deltas from context.
​

So the short answer is: structure .strux as a context cascade plus tiny delta panels, and link by alias, type path, and implicit chain rather than repeated inline config and explicit snaps.
