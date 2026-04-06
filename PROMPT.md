Study specs/* to understand the project requirements.
Study AGENT.md for build, run, and test instructions.
Study fix_plan.md for current progress.
For all overall architecture, you can reference ai_debate_arena_d9c450cb.plan.md in this repo as needed.

Choose the next unfinished item from fix_plan.md and implement it. You must update fix_plan.md after you are finished your task with your progress. 
An unfinished item is 1 specific item. When you are finished implementation and testing of your item, stop and do nothing else. Do not take on full phases in 1 go. 
An item refers specifically to one of the subheadings like **3.1** Create `backend/app/services/__init__.py`. If one of the specs is relevant to the current item you are working on,
please ensure your implementation adheres to the spec. Make sure to also look at the "Recommended skills.sh Skills" section for skills you should download. AGENT.md gives you instructions
on how to download them. Using skills is important in adhering to best practices. Unless an implementation is extremely trivial, please use skills where applicable. 

Before making changes, search the codebase — do not assume something is not implemented.

After implementing, run the tests for the code you changed. If tests fail, fix them before moving on.

If tests pass, update fix_plan.md with progress, then git add and commit with a descriptive message.

If you learn something new about how to build, run, or test the project, update AGENT.md. As you update the project structure, also update AGENT.md.
Keep AGENT.md up to date with information on how to build the compiler and your learnings to optimise the build/test loop using a subagent.

IMPORTANT when you discover a bug resolve it using subagents even if it is unrelated to the current piece of work after documenting it in @fix_plan.md

For any bugs you discover, resolve them or document them in fix_plan.md.

Do not write placeholder or minimal implementations. Full implementations only.
