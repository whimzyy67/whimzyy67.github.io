/* Shared to-do list.
   Every page with a to-do list calls setupTodo() with its own list, form and input.
   All pages read and write the same saved list, so the tasks are always the same.

   The 4th part, onChange, is optional. If a page gives one (like My Day does with
   updateProgress), it is called with the tasks every time the list is drawn. */

const TASKS_KEY = "whimzyy-tasks";

/* New day, fresh list: a task that was ticked off on an EARLIER day is no longer shown
   on the to-do lists. Tasks you have not finished stay until you do them.
   (Nothing is deleted, so Dayverse and Productivity still count the old ticks.) */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
function isOldFinished(task) {
  return !!(task && task.done && (!task.doneAt || task.doneAt < startOfToday()));
}

function setupTodo(listEl, formEl, inputEl, onChange) {
  let tasks = [];

  // read the saved tasks
  function loadTasks() {
    try {
      tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
    } catch (error) {
      tasks = [];
    }
    if (!Array.isArray(tasks)) {
      tasks = [];
    }
  }

  // save the tasks
  function saveTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  // draw the whole list from the tasks array
  function renderTasks() {
    listEl.textContent = "";

    tasks.forEach(function (task, index) {
      if (isOldFinished(task)) {
        return;   // finished on an earlier day: hidden from today's list
      }
      const li = document.createElement("li");
      li.className = "todo-item";

      // tick box
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = task.done;
      check.setAttribute("aria-label", "Mark task as done");
      check.addEventListener("change", function () {
        task.done = check.checked;
        task.doneAt = check.checked ? Date.now() : null;   // remembers when it was ticked

        // STARS: 1 star the FIRST time a task is ticked (ticking it again gives nothing)
        if (check.checked && !task.rewarded && window.Rewards) {
          task.rewarded = Rewards.onTaskDone(task.text);
        }

        saveTasks();
        renderTasks();
      });

      // task text: click it to edit
      const text = document.createElement("input");
      text.type = "text";
      text.className = "task-text";
      text.value = task.text;
      text.title = "Click to edit";
      text.setAttribute("aria-label", "Task");
      if (task.done) {
        text.classList.add("done");
      }
      text.addEventListener("change", function () {
        const value = text.value.trim();
        if (value === "") {
          tasks.splice(index, 1);   // an empty task is removed
        } else {
          task.text = value;
        }
        saveTasks();
        renderTasks();
      });

      // delete button
      const del = document.createElement("button");
      del.type = "button";
      del.className = "task-delete";
      del.textContent = "✕";
      del.title = "Delete task";
      del.setAttribute("aria-label", "Delete task");
      del.addEventListener("click", function () {
        tasks.splice(index, 1);
        saveTasks();
        renderTasks();
      });

      li.append(check, text, del);
      listEl.appendChild(li);
    });

    // tell the page the list was drawn (My Day uses this for the % completed)
    if (typeof onChange === "function") {
      onChange(tasks.filter(function (task) { return !isOldFinished(task); }));
    }
  }

  // adding a new task
  formEl.addEventListener("submit", function (event) {
    event.preventDefault();

    const value = inputEl.value.trim();
    if (value === "") {
      return;
    }

    tasks.push({ text: value, done: false });
    inputEl.value = "";
    saveTasks();
    renderTasks();
  });

  // if the list is changed in another open tab, show the change here too
  window.addEventListener("storage", function (event) {
    if (event.key === TASKS_KEY) {
      loadTasks();
      renderTasks();
    }
  });

  loadTasks();
  renderTasks();

  // if the page stays open past midnight, start the new day's list by itself
  const msToMidnight = startOfToday() + 24 * 60 * 60 * 1000 - Date.now() + 1000;
  setTimeout(function () {
    loadTasks();
    renderTasks();
  }, msToMidnight);
}
