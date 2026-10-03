/* Local-only decision flow. No tracking, form submission, or answer storage. */
(() => {
  "use strict";
  const tool = document.querySelector("#decision-tool");
  const fallback = document.querySelector("#decision-fallback");
  const title = document.querySelector("#question-title");
  const help = document.querySelector("#question-help");
  const questionView = document.querySelector("#question-view");
  const resultView = document.querySelector("#result-view");
  const back = document.querySelector("#back-button");
  const reset = document.querySelector("#reset-button");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Named transitions make policy exceptions explicit; uncertainty never means permission.
  const questions = {
    policy: {
      number: 1,
      label: "Course policy",
      title: "Do the course instructions prohibit your planned AI use?",
      help: "Check the syllabus, assignment sheet, and instructor’s messages. Restrictions may apply to only some uses. Choose “No” only when you understand the policy and your planned use is allowed.",
      next: { yes: "stop", no: "assessment", unsure: "ask" },
    },
    assessment: {
      number: 2,
      label: "Assessment",
      title: "Is this an exam, quiz, or take-home assessment?",
      help: "Checking answers with AI also counts as using it. Assessment rules may be stricter than the general course policy.",
      next: { yes: "permission", no: "personal", unsure: "ask" },
    },
    permission: {
      number: 3,
      label: "Explicit permission",
      title: "Do the assessment instructions explicitly allow this AI use?",
      help: "Look for permission that covers the specific help you want. A take-home format or silence about AI is not permission.",
      next: { yes: "personal", no: "stop", unsure: "ask" },
    },
    personal: {
      number: 4,
      label: "Your voice",
      title: "Is this about your own experiences, beliefs, or reflection?",
      help: "If so, keep the ideas and final wording yours. Any permitted editing support should help you communicate, rather than invent a perspective for you.",
      next: { yes: "verify", no: "verify", unsure: "ask" },
    },
    verify: {
      number: 5,
      label: "Verification",
      title: "Can you evaluate and verify the AI’s output?",
      help: "You need enough understanding to check claims against course materials and credible sources, and to recognize misleading summaries or invented citations.",
      next: { yes: "privacy", no: "research", unsure: "research" },
    },
    privacy: {
      number: 6,
      label: "Privacy",
      title:
        "Can you use AI without sharing sensitive or unauthorized material?",
      help: "Keep personal data, confidential information, and other people’s work out of prompts unless you have appropriate permission and understand the tool’s data rules.",
      next: { yes: "transparency", no: "protect", unsure: "protect" },
    },
    transparency: {
      number: 7,
      label: "Transparency",
      title:
        "Can you describe your AI use openly and meet disclosure requirements?",
      help: "Be specific about the help you used. Keep prompts or drafts if required. If you would hide the process, change your approach before submitting.",
      next: { yes: "proceed", no: "pause", unsure: "ask" },
    },
  };
  const results = {
    stop: {
      category: "Use your own work",
      title: "Leave AI out of this task.",
      copy: "Your planned use is restricted or lacks explicit assessment permission. Complete the task without AI. Ask your instructor if you need clarification or another kind of support.",
      link: "#scenarios",
      action: "Review the boundaries",
    },
    ask: {
      category: "Clarify before continuing",
      title: "Ask your instructor first.",
      copy: "An unclear rule or requirement needs a human answer. Describe the assignment and the specific AI help you want, then ask whether it is allowed and how to disclose it. Until you know, work without AI.",
      link: "#scenarios",
      action: "Explore the scenarios",
    },
    research: {
      category: "Build understanding first",
      title: "Read, research, then reconsider.",
      copy: "Start with course readings and credible sources. Once you understand the topic well enough to check an output, revisit this decision. A convincing AI answer is not evidence on its own.",
      link: "#practice",
      action: "Explore learning support",
    },
    protect: {
      category: "Protect the material",
      title: "Change what you share.",
      copy: "Remove sensitive information and material you do not have permission to share. If you cannot do that—or the data rules remain unclear—choose a method that keeps the material out of the AI tool.",
      link: "#ethics",
      action: "Review the ethics checks",
    },
    pause: {
      category: "Rethink the approach",
      title: "Make transparency possible.",
      copy: "If you cannot describe the help honestly or meet disclosure requirements, pause. Revise the process or complete the work without AI. Disclosure cannot override a restriction.",
      link: "#voice",
      action: "Keep your voice visible",
    },
    proceed: {
      category: "A considered next step",
      title: "Use limited, purposeful support.",
      copy: "Based on your answers, your planned use may fit the assignment. Choose a limited role for AI, verify every claim and source, and follow the course’s disclosure rules. This result is guidance, not instructor approval.",
      link: "#practice",
      action: "Choose a responsible use",
    },
  };
  let state = "policy";
  let history = [];
  let personal = false;

  function animate(view) {
    view.getAnimations?.().forEach((animation) => animation.cancel());
    if (motion.matches || !view.animate) return;
    // Animate the updated step without forcing the browser to recalculate layout.
    view.animate(
      [
        { opacity: 0.65, transform: "translateY(5px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 250, easing: "cubic-bezier(.16,1,.3,1)" },
    );
  }

  // Focus must stay below the sticky header, including on narrow or zoomed screens.
  function focusHeading(heading) {
    heading.focus({ preventScroll: true });
    const top =
      document.querySelector(".site-header").getBoundingClientRect().bottom +
      24;
    const bounds = heading.getBoundingClientRect();
    if (bounds.top < top || bounds.bottom > window.innerHeight - 24) {
      window.scrollBy({ top: bounds.top - top, behavior: "instant" });
    }
  }

  function render(moveFocus = true, announcementPrefix = "") {
    const question = questions[state];
    back.disabled = history.length === 0;
    questionView.hidden = !question;
    resultView.hidden = Boolean(question);
    if (question) {
      document.querySelector("#step-label").textContent =
        `Check ${history.length + 1} · ${question.label}`;
      document.querySelector("#step-fill").style.transform =
        `scaleX(${question.number / 7})`;
      title.textContent = question.title;
      help.textContent = question.help;
      animate(questionView);
      if (moveFocus) {
        focusHeading(title);
        document.querySelector("#tool-status").textContent =
          `${announcementPrefix}Check ${history.length + 1}: ${question.label}.`;
      }
    } else {
      const result = results[state];
      document.querySelector("#step-label").textContent = "Your next step";
      document.querySelector("#step-fill").style.transform = "scaleX(1)";
      document.querySelector("#result-category").textContent = result.category;
      const resultTitle = document.querySelector("#result-title");
      resultTitle.textContent = result.title;
      document.querySelector("#result-copy").textContent = result.copy;
      document.querySelector("#personal-note").hidden = !(
        personal && state === "proceed"
      );
      const link = document.querySelector("#result-link");
      link.href = result.link;
      link.textContent = result.action;
      animate(resultView);
      if (moveFocus) {
        focusHeading(resultTitle);
        // Announce the result category; the focused heading supplies the full title.
        document.querySelector("#tool-status").textContent =
          `Result: ${result.category}.`;
      }
    }
  }

  if (tool && fallback) {
    tool.querySelectorAll("[data-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const answer = button.dataset.answer;
        const question = questions[state];
        if (!question) return;
        history.push({ state, personal });
        if (state === "personal") personal = answer === "yes";
        state = question.next[answer];
        document.querySelector("#tool-status").textContent = "";
        render();
      });
    });
    back.addEventListener("click", () => {
      const previous = history.pop();
      if (!previous) return;
      state = previous.state;
      personal = previous.personal;
      render();
    });
    reset.addEventListener("click", () => {
      state = "policy";
      history = [];
      personal = false;
      render(true, "Decision guide restarted. Previous answers cleared. ");
    });
    render(false);
    fallback.hidden = true;
    tool.hidden = false;
  }

  // A passive scroll handler schedules one visual update per animation frame.
  const progress = document.querySelector("#reading-progress");
  let scheduled = false;
  function updateProgress() {
    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight;
    const fraction =
      scrollable > 0
        ? Math.min(1, Math.max(0, window.scrollY / scrollable))
        : 0;
    if (progress) progress.style.transform = `scaleX(${fraction})`;
    scheduled = false;
  }
  function scheduleProgress() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateProgress);
    }
  }
  window.addEventListener("scroll", scheduleProgress, { passive: true });
  window.addEventListener("resize", scheduleProgress);
  document.fonts?.ready.then(scheduleProgress);
  updateProgress();

  // Already-visible section introductions receive a single, restrained reveal.
  let observer;
  function setupReveals() {
    observer?.disconnect();
    if (motion.matches || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".reveal:not(.is-revealed)")
      .forEach((element) => observer.observe(element));
  }
  motion.addEventListener("change", () => {
    if (motion.matches) {
      questionView
        ?.getAnimations?.()
        .forEach((animation) => animation.cancel());
      resultView?.getAnimations?.().forEach((animation) => animation.cancel());
    }
    setupReveals();
  });
  setupReveals();
})();
