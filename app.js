import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getFirestore,
    onSnapshot,
    query,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDWOx9PjyfbbOrYYQ2gd_1vLcPI7CEz3XQ",
    authDomain: "my-todo-app-5c377.firebaseapp.com",
    projectId: "my-todo-app-5c377",
    storageBucket: "my-todo-app-5c377.firebasestorage.app",
    messagingSenderId: "1047333914650",
    appId: "1:1047333914650:web:2296632cfcb2582a98e9a3",
    measurementId: "G-Y6PXSSLS8S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const isDashboard = document.body.dataset.page === "dashboard";

let isSignupMode = false;
let unsubscribeTodos = null;

const loadingSpinner = document.getElementById("loading-spinner");
const authSection = document.getElementById("auth-section");
const authNavSection = document.getElementById("auth-nav-section");
const authForm = document.getElementById("auth-form");
const authFormTitle = document.getElementById("auth-form-title");
const authFormSubtitle = document.getElementById("auth-form-subtitle");
const authBtn = document.getElementById("auth-btn");
const toggleAuthText = document.getElementById("toggle-auth-text");
const authAlert = document.getElementById("auth-alert");
const todoSection = document.getElementById("todo-section");
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const noTodos = document.getElementById("no-todos");
const taskCount = document.getElementById("task-count");
const todoAlert = document.getElementById("todo-alert");
const addTaskBtn = document.getElementById("add-task-btn");
const todoLoading = document.getElementById("todo-loading");

function showAlert(element, message, type = "danger") {
    element.textContent = message;
    element.className = `alert alert-${type} py-2 small border-0`;
}

function getFriendlyError(error) {
    const messages = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/network-request-failed": "Network error. Check your internet connection.",
        "permission-denied": "Permission denied. Please check Firestore rules.",
        "unavailable": "Service temporarily unavailable. Try again."
    };

    return messages[error.code] || error.message?.replace("Firebase: ", "") || "Something went wrong. Please try again.";
}

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    authAlert.classList.add("d-none");
    document.getElementById("password").value = "";

    if (isSignupMode) {
        authFormTitle.textContent = "Create Account";
        authFormSubtitle.textContent = "Sign up to start organizing your workflow.";
        authBtn.textContent = "Sign Up";
        document.getElementById("password").setAttribute("autocomplete", "new-password");
        toggleAuthText.innerHTML = `Already have an account?
            <a href="#" id="toggle-auth-mode" class="fw-bold text-decoration-none text-purple">Login</a>`;
    } else {
        authFormTitle.textContent = "Welcome Back";
        authFormSubtitle.textContent = "Enter your details to manage your daily tasks.";
        authBtn.textContent = "Login";
        document.getElementById("password").setAttribute("autocomplete", "current-password");
        toggleAuthText.innerHTML = `Don't have an account?
            <a href="#" id="toggle-auth-mode" class="fw-bold text-decoration-none text-purple">Sign Up</a>`;
    }
}

if (authForm) {
    toggleAuthText.addEventListener("click", (event) => {
        if (event.target.closest("#toggle-auth-mode")) {
            event.preventDefault();
            toggleAuthMode();
        }
    });

    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        authAlert.classList.add("d-none");
        authBtn.disabled = true;
        authBtn.textContent = "Please wait...";

        try {
            if (isSignupMode) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            authForm.reset();
        } catch (error) {
            console.error("Authentication error:", error);
            showAlert(authAlert, getFriendlyError(error));
        } finally {
            authBtn.disabled = false;
            authBtn.textContent = isSignupMode ? "Sign Up" : "Login";
        }
    });
}

function renderNavbar(user) {
    authNavSection.replaceChildren();
    if (!user) return;

    const emailSpan = document.createElement("span");
    emailSpan.id = "user-email";
    emailSpan.className = "text-white small me-2";
    emailSpan.textContent = user.email || "User";

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-light btn-sm fw-bold rounded-3 px-3 shadow-sm";
    logoutBtn.style.color = "var(--purple-primary)";
    logoutBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket me-1"></i>Logout';
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
            showAlert(todoAlert, getFriendlyError(error));
        }
    });

    authNavSection.append(emailSpan, logoutBtn);
}

onAuthStateChanged(auth, (user) => {
    loadingSpinner.style.display = "none";

    if (isDashboard) {
        if (!user) {
            window.location.replace("login.html");
            return;
        }

        todoSection.style.display = "flex";
        renderNavbar(user);
        loadUserTodos(user.uid);
        return;
    }

    if (user) {
        window.location.replace("dashboard.html");
        return;
    }

    authSection.style.display = "flex";
}, (error) => {
    console.error("Authentication state error:", error);
    loadingSpinner.style.display = "none";

    if (isDashboard) {
        todoSection.style.display = "flex";
        showAlert(todoAlert, getFriendlyError(error));
    } else {
        authSection.style.display = "flex";
        showAlert(authAlert, getFriendlyError(error));
    }
});

if (todoForm) {
    todoForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const text = todoInput.value.trim();
        const user = auth.currentUser;
        if (!user || !text) return;

        if (text.length > 300) {
            showAlert(todoAlert, "Task cannot exceed 300 characters.");
            return;
        }

        addTaskBtn.disabled = true;
        addTaskBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Adding...';
        todoAlert.classList.add("d-none");

        try {
            await addDoc(collection(db, "todos"), {
                text,
                uid: user.uid,
                createdAt: serverTimestamp()
            });
            todoInput.value = "";
            todoInput.focus();
            showAlert(todoAlert, "Task added successfully!", "success");
        } catch (error) {
            console.error("Add task error:", error);
            showAlert(todoAlert, getFriendlyError(error));
        } finally {
            addTaskBtn.disabled = false;
            addTaskBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i>Add Task';
        }
    });
}

function loadUserTodos(uid) {
    if (unsubscribeTodos) unsubscribeTodos();

    todoLoading.classList.remove("d-none");
    noTodos.classList.add("d-none");
    todoList.replaceChildren();

    const todosQuery = query(collection(db, "todos"), where("uid", "==", uid));
    unsubscribeTodos = onSnapshot(
        todosQuery,
        (snapshot) => {
            const todos = snapshot.docs.map((document) => ({
                id: document.id,
                ...document.data()
            }));

            todos.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });

            renderTodos(todos);
            todoLoading.classList.add("d-none");
        },
        (error) => {
            console.error("Firestore error:", error);
            todoLoading.classList.add("d-none");
            showAlert(todoAlert, getFriendlyError(error));
        }
    );
}

function renderTodos(todos) {
    todoList.replaceChildren();
    taskCount.textContent = `${todos.length} Task${todos.length === 1 ? "" : "s"}`;

    if (todos.length === 0) {
        noTodos.classList.remove("d-none");
        return;
    }

    noTodos.classList.add("d-none");
    const fragment = document.createDocumentFragment();

    todos.forEach((todo) => {
        const item = document.createElement("li");
        item.className = "list-group-item task-item d-flex justify-content-between align-items-center p-3 shadow-sm";

        const content = document.createElement("div");
        content.className = "d-flex align-items-center flex-grow-1 me-2";

        const icon = document.createElement("i");
        icon.className = "fa-regular fa-circle-check me-3 text-purple";

        const text = document.createElement("span");
        text.className = "fw-medium text-dark task-text";
        text.textContent = todo.text || "";
        content.append(icon, text);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-sm btn-link text-danger text-decoration-none border-0 delete-btn";
        deleteBtn.title = "Delete task";
        deleteBtn.setAttribute("aria-label", "Delete task");
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.addEventListener("click", () => deleteTodo(todo.id, deleteBtn));

        item.append(content, deleteBtn);
        fragment.appendChild(item);
    });

    todoList.appendChild(fragment);
}

async function deleteTodo(id, button) {
    const user = auth.currentUser;
    if (!user || !window.confirm("Are you sure you want to delete this task?")) return;

    button.disabled = true;
    try {
        await deleteDoc(doc(db, "todos", id));
        showAlert(todoAlert, "Task deleted successfully!", "success");
    } catch (error) {
        console.error("Delete error:", error);
        showAlert(todoAlert, getFriendlyError(error));
        button.disabled = false;
    }
}
