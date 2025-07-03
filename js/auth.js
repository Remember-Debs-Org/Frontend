const API_BASE = "http://localhost:8080/api/v1/auth";

// --- LOGIN ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        errorMsg.style.display = "block";
        errorMsg.textContent = "Correo o contraseña incorrectos.";
        return;
      }

      const data = await res.json();
      // Guardar el token y otros datos útiles en localStorage
      localStorage.setItem("jwt", data.token);
      localStorage.setItem("userFirstName", data.firstName);
      localStorage.setItem("userLastName", data.lastName);
      localStorage.setItem("userRole", data.role);

      // Redirigir al dashboard
      window.location.href = "dashboard.html";
    } catch (err) {
      errorMsg.style.display = "block";
      errorMsg.textContent = "Error al conectar con el servidor.";
    }
  });
}

// --- REGISTRO ---
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstName = document.getElementById("firstName").value;
    const lastName = document.getElementById("lastName").value;
    const userTelefono = document.getElementById("userTelefono").value;
    const userEmail = document.getElementById("userEmail").value;
    const userPassword = document.getElementById("userPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const errorMsg = document.getElementById("register-error-msg");

    // Validar contraseñas coinciden
    if (userPassword !== confirmPassword) {
      errorMsg.style.display = "block";
      errorMsg.textContent = "Las contraseñas no coinciden.";
      return;
    }

    // Opcional: podrías validar pattern/formatos aquí si quieres
    try {
      const res = await fetch(`${API_BASE}/register/usuario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          userTelefono,
          userEmail,
          userPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        errorMsg.style.display = "block";
        errorMsg.textContent =
          data.message ||
          "No se pudo registrar. Revisa los datos e inténtalo de nuevo.";
        return;
      }

      // Registro exitoso: Redirige al login con mensaje (opcional)
      alert("¡Registro exitoso! Ahora puedes iniciar sesión.");
      window.location.href = "index.html";
    } catch (err) {
      errorMsg.style.display = "block";
      errorMsg.textContent = "Error al conectar con el servidor.";
    }
  });
}
