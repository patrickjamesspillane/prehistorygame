(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  const game = $("game");
  const setup = $("setup");
  const play = $("play");
  const result = $("result");
  const modeInput = $("mode");
  const speedInput = $("speed");
  const startButton = $("start");
  const progress = $("progress");
  const question = $("question");
  const flight = $("flight");
  const ship = $("ship");
  const selection = $("selection");
  const options = $("options");
  const upButton = $("up");
  const downButton = $("down");
  const pauseButton = $("pause");
  const menuButton = $("menu");
  const restartButton = $("restart");
  const fullscreenButton = $("fullscreen");
  const fullscreenNote = $("fullscreen-note");

  const targets = Array.from(
    flight.querySelectorAll(".target")
  );

  const questions = [
    {
      text: "¿Qué herramienta serviría para cortar los tallos de los cereales?",
      answers: [
        "Una hoz",
        "Un molino de mano",
        "Un recipiente de cerámica"
      ],
      correct: 0
    },
    {
      text: "¿Qué materiales elegiríamos para un hacha de piedra?",
      answers: [
        "Acero y plástico",
        "Piedra, madera y fibras",
        "Papel y vidrio"
      ],
      correct: 1
    },
    {
      text: "¿Para qué se utilizaba un molino de mano?",
      answers: [
        "Para cocer recipientes",
        "Para cortar madera",
        "Para triturar el grano"
      ],
      correct: 2
    },
    {
      text: "¿Qué material utilizaríamos para modelar una vasija de cerámica?",
      answers: [
        "Arcilla",
        "Plástico",
        "Acero"
      ],
      correct: 0
    },
    {
      text: "¿Dónde conviene guardar el grano para protegerlo de la humedad?",
      answers: [
        "En un charco",
        "En un lugar seco y protegido",
        "Bajo la lluvia"
      ],
      correct: 1
    },
    {
      text: "Antes de empezar una reparación, ¿qué conviene hacer?",
      answers: [
        "Elegir materiales al azar",
        "Empezar sin observar",
        "Observar los daños y planificar"
      ],
      correct: 2
    },
    {
      text: "Si dos tareas necesitan la misma herramienta, ¿cómo podemos organizarnos?",
      answers: [
        "Acordar turnos",
        "Usarla todos a la vez",
        "Abandonar las dos tareas"
      ],
      correct: 0
    },
    {
      text: "¿Qué hace más convincente una propuesta para ayudar a la aldea?",
      answers: [
        "No explicar las decisiones",
        "Justificarla con lo investigado",
        "Elegirla solo por su aspecto"
      ],
      correct: 1
    }
  ];

  let index = 0;
  let score = 0;
  let lane = 1;
  let elapsed = 0;
  let duration = 16000;
  let lastTime = null;

  let animationId = null;
  let bankTimer = null;
  let transitionTimer = null;
  let transitionDeadline = 0;
  let transitionRemaining = 0;

  let active = false;
  let paused = false;
  let betweenQuestions = false;
  let mode = "flight";
  let displayedAnswers = [];
  let flyingAnswers = [];

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    modeInput.value = "calm";
  }

  function focusWithoutScroll(element) {
    element.focus({ preventScroll: true });
  }

  function shuffle(items) {
    const copy = items.slice();

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function updateSettings() {
    speedInput.disabled = modeInput.value === "calm";
  }

  modeInput.addEventListener("change", updateSettings);
  updateSettings();

  function stopAnimation() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function levelShip() {
    clearTimeout(bankTimer);
    ship.style.setProperty("--bank", "0deg");
  }

  function updateProgress() {
    progress.textContent =
      "Pregunta " + (index + 1) +
      " de " + questions.length +
      " · Puntos: " + score;
  }

  function updateLane(animate) {
    const nextTop = (lane + 0.5) * 100 / 3;
    const previousTop = parseFloat(ship.style.top) || 50;

    clearTimeout(bankTimer);

    if (animate) {
      const bank = nextTop < previousTop
        ? -12
        : nextTop > previousTop
          ? 12
          : 0;

      ship.style.setProperty("--bank", bank + "deg");

      bankTimer = setTimeout(function () {
        ship.style.setProperty("--bank", "0deg");
      }, 280);
    } else {
      ship.style.setProperty("--bank", "0deg");
    }

    ship.style.top = nextTop + "%";

    if (mode === "flight" && displayedAnswers[lane]) {
      selection.textContent =
        "Carril " + (lane + 1) + ": " +
        displayedAnswers[lane].text +
        (flyingAnswers[lane].passed ? " · Ya ha pasado" : "");
    }

    upButton.disabled = !active || paused || lane === 0;
    downButton.disabled = !active || paused || lane === 2;
  }

  function move(direction) {
    if (!active || paused || mode !== "flight") return;

    lane = Math.max(0, Math.min(2, lane + direction));
    updateLane(true);
  }

  function prepareAnswers() {
    displayedAnswers = shuffle(
      questions[index].answers.map(function (text, originalIndex) {
        return { text, originalIndex };
      })
    );

    const arrivalOrder = shuffle([0, 1, 2]);

    flyingAnswers = displayedAnswers.map(function (answer, number) {
      return {
        originalIndex: answer.originalIndex,
        startX: 100 + arrivalOrder[number] * 26,
        passed: false
      };
    });

    targets.forEach(function (target, number) {
      target.textContent = displayedAnswers[number].text;
      target.style.opacity = "1";
      target.style.left = flyingAnswers[number].startX + "%";
      target.style.top = ((number + 0.5) * 100 / 3) + "%";
    });
  }

  function positionTargets() {
    const distance = (elapsed / duration) * 88;

    flyingAnswers.forEach(function (answer, number) {
      targets[number].style.left =
        (answer.startX - distance) + "%";
    });
  }

  function checkCrossings() {
    const distance = (elapsed / duration) * 88;
    const areaRect = flight.getBoundingClientRect();
    const shipRect = ship.getBoundingClientRect();

    if (!areaRect.height) return;

    const centreY =
      shipRect.top + shipRect.height / 2 - areaRect.top;

    const visibleLane = Math.max(
      0,
      Math.min(2, Math.floor(centreY / (areaRect.height / 3)))
    );

    for (let number = 0; number < flyingAnswers.length; number++) {
      const answer = flyingAnswers[number];
      const left = answer.startX - distance;

      if (!answer.passed && left <= 12) {
        answer.passed = true;

        if (visibleLane === number) {
          submitAnswer(answer.originalIndex);
          return;
        }

        targets[number].style.opacity = "0.35";

        if (lane === number) {
          updateLane(false);
        }
      }
    }

    if (
      active &&
      flyingAnswers.every(answer => answer.passed)
    ) {
      submitAnswer(null);
    }
  }

  function tick(time) {
    if (!active || paused) return;

    if (lastTime !== null) {
      elapsed += Math.min(time - lastTime, 100);
    }

    lastTime = time;

    positionTargets();
    checkCrossings();

    if (active && !paused) {
      animationId = requestAnimationFrame(tick);
    }
  }

  function showQuestion() {
    stopAnimation();
    levelShip();
    clearTimeout(transitionTimer);

    betweenQuestions = false;
    active = true;
    paused = false;
    lane = 1;
    elapsed = 0;
    lastTime = null;

    updateProgress();
    question.textContent = questions[index].text;

    flight.hidden = mode !== "flight";
    options.hidden = mode !== "calm";
    upButton.hidden = mode !== "flight";
    downButton.hidden = mode !== "flight";
    pauseButton.hidden = mode !== "flight";

    pauseButton.textContent = "Pausar";
    pauseButton.disabled = false;

    prepareAnswers();
    options.replaceChildren();

    if (mode === "calm") {
      selection.textContent = "Elegid una respuesta.";

      displayedAnswers.forEach(function (answer) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = answer.text;

        button.addEventListener("click", function () {
          submitAnswer(answer.originalIndex);
        });

        options.appendChild(button);
      });

      focusWithoutScroll(options.querySelector("button"));
    } else {
      flight.classList.remove("is-still");
      updateLane(false);
      positionTargets();

      animationId = requestAnimationFrame(tick);
    }
  }

  function scheduleNextQuestion(delay) {
    clearTimeout(transitionTimer);

    transitionRemaining = delay;
    transitionDeadline = performance.now() + delay;

    transitionTimer = setTimeout(function () {
      betweenQuestions = false;
      index++;

      if (index < questions.length) {
        showQuestion();
      } else {
        finish();
      }
    }, delay);
  }

  function submitAnswer(answerIndex) {
    if (!active) return;

    active = false;
    betweenQuestions = true;

    stopAnimation();
    levelShip();
    flight.classList.add("is-still");

    if (answerIndex === questions[index].correct) {
      score += 10;
    }

    updateProgress();

    options.querySelectorAll("button").forEach(function (button) {
      button.disabled = true;
    });

    upButton.disabled = true;
    downButton.disabled = true;
    pauseButton.disabled = true;

    selection.textContent = "Preparando la siguiente pregunta…";

    scheduleNextQuestion(650);
  }

  function finish() {
    active = false;
    paused = false;
    betweenQuestions = false;

    stopAnimation();
    levelShip();
    clearTimeout(transitionTimer);

    flight.classList.add("is-still");
    play.hidden = true;
    result.hidden = false;

    $("result-score").textContent =
      score + " / " + (questions.length * 10) + " puntos";

    focusWithoutScroll(restartButton);
  }

  function returnToMenu() {
    active = false;
    paused = false;
    betweenQuestions = false;

    stopAnimation();
    levelShip();
    clearTimeout(transitionTimer);

    flight.classList.add("is-still");

    play.hidden = true;
    result.hidden = true;
    setup.hidden = false;

    focusWithoutScroll(startButton);
  }

  function pauseGame() {
    if (!active || paused || mode !== "flight") return;

    paused = true;

    stopAnimation();
    levelShip();

    flight.classList.add("is-still");
    pauseButton.textContent = "Continuar";
    selection.textContent = "Juego en pausa.";

    upButton.disabled = true;
    downButton.disabled = true;
  }

  function resumeGame() {
    if (!active || !paused || mode !== "flight") return;

    paused = false;
    lastTime = null;

    flight.classList.remove("is-still");
    pauseButton.textContent = "Pausar";

    updateLane(false);
    animationId = requestAnimationFrame(tick);
  }

  startButton.addEventListener("click", function () {
    stopAnimation();
    clearTimeout(transitionTimer);

    index = 0;
    score = 0;
    mode = modeInput.value;
    duration = Number(speedInput.value) * 1000;

    setup.hidden = true;
    result.hidden = true;
    play.hidden = false;

    showQuestion();

    if (mode === "flight") {
      focusWithoutScroll(pauseButton);
    }
  });

  upButton.addEventListener("click", () => move(-1));
  downButton.addEventListener("click", () => move(1));

  pauseButton.addEventListener("click", function () {
    if (paused) {
      resumeGame();
    } else {
      pauseGame();
    }
  });

  menuButton.addEventListener("click", returnToMenu);
  restartButton.addEventListener("click", returnToMenu);

  document.addEventListener("keydown", function (event) {
    if (!active || paused || mode !== "flight") return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      pauseGame();

      if (betweenQuestions) {
        clearTimeout(transitionTimer);

        transitionRemaining = Math.max(
          0,
          transitionDeadline - performance.now()
        );
      }
    } else if (betweenQuestions) {
      scheduleNextQuestion(transitionRemaining);
    }
  });

  /* Fullscreen */
  fullscreenButton.addEventListener("click", async function () {
    fullscreenNote.hidden = true;

    try {
      if (document.fullscreenElement === game) {
        await document.exitFullscreen();
      } else {
        if (!game.requestFullscreen || !document.fullscreenEnabled) {
          throw new Error("Fullscreen unavailable");
        }

        await game.requestFullscreen();
      }
    } catch (error) {
      fullscreenNote.textContent =
        "No se ha podido activar la pantalla completa. " +
        "Podéis seguir jugando en esta ventana.";

      fullscreenNote.hidden = false;
    }
  });

  document.addEventListener("fullscreenchange", function () {
    fullscreenButton.textContent =
      document.fullscreenElement === game
        ? "⛶ Salir de pantalla completa"
        : "⛶ Pantalla completa";
  });
})();
