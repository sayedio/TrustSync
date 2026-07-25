1.⁠ ⁠TEAM INFORMATION
Team Name: The Overfitters
AI Innovation Hackathon 2026 Organized By Department Of CSE, DIU Final Round: Additional Challenge Task
Project Title: TrustSync.AI, Intelligent Payment Recovery for Webhook Failures
Track: AI for Cluster Intelligence (Predictive Operations)
2.⁠ ⁠PROBLEM STATEMENT
TrustSync. Al resends a payment message when it thinks the first one was lost. But a message that was not really lost will now arrive twice. A shop may then ship one order two times. A broken shop server can also pull the system into endless retries. The team must make recovery safe for the shop and for the platform.
3.⁠ ⁠BACKGROUND
In payments, a repeated message costs as much as a lost one. Shops trust a system only when each payment appears exactly once. A retry storm against one broken shop can slow every other shop. Clear limits and a matching report make recovery safe.
4.⁠ ⁠ADDITIONAL CHALLENGE TASK
Build a new module named "Duplicate Guard and Retry Budget". It must sit on top of your existing retry scheduler.
Duplicate Guard: Give each payment a unique key. Make sure the shop accepts it only once, even after several retries.
Retry Budget: Set a limit on retries per shop in a time window. Pause a shop that keeps failing and mark it for review.
Matching Report: List all successful payments and their confirmations. Prove that each one was delivered exactly once.
Show the report and the paused shops in your dashboard. Use a simulated payment gateway and simulated shop servers only.
5.⁠ ⁠EXPECTED DELIVERABLES
After two and a half hours, teams must show an updated prototype in a live or simulated run. The run must show one repeated delivery blocked and one shop paused by the budget. The matching report must also be shown. Teams must submit the source code, a short note on their design choices, and a few slides.

6. EVALUATION CONSIDERATIONS
Judges may assess innovation, technical quality, and the quality of integration with the existing system. They may also assess real user impact, honest and effective use of AI tools, and the clarity of the final presentation.