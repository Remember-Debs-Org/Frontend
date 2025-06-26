// --- Función para decodificar el JWT y obtener info del usuario ---
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

// --- Proteger el dashboard ---
const token = localStorage.getItem('jwt');
if (!token) window.location.href = "index.html";
const payload = parseJwt(token);
if (!payload) {
  localStorage.clear();
  window.location.href = "index.html";
}
const userId = payload.id;
const userName = localStorage.getItem('userFirstName') || payload.firstName || "";

// Mostrar nombre en header
document.getElementById('user-name').textContent = userName;

// Logout
document.getElementById('logout-btn').onclick = () => {
  localStorage.clear();
  window.location.href = "index.html";
};

// --- API base ---
const API_BASE = "http://localhost:8080/api/v1";

// --- Cargar deudas ---
async function cargarDeudas() {
  const list = document.getElementById("deudas-list");
  list.innerHTML = "<i style='color:#888;'>Cargando...</i>";
  try {
    const res = await fetch(`${API_BASE}/deudas/usuario/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al cargar deudas");
    const deudas = await res.json();
    list.innerHTML = "";
    if (!deudas || deudas.length === 0) {
      list.innerHTML = "<p>No tienes deudas registradas.</p>";
      return;
    }
    deudas.forEach(deuda => {
      const div = document.createElement("div");
      div.className = "deuda-card";
      div.innerHTML = `
        <b>${deuda.nombre}</b> | Categoría: ${deuda.categoriaNombre} <br>
        Monto: S/ ${deuda.monto} | Estado: ${deuda.estado} <br>
        ${
          deuda.fechaVencimiento
            ? `Vencimiento: ${deuda.fechaVencimiento}`
            : deuda.fechaLimitePago
              ? `Fecha límite: ${deuda.fechaLimitePago}`
              : deuda.fechaPago
                ? `Pagada el: ${deuda.fechaPago}`
                : ''
        }
      `;
      list.appendChild(div);
    });
  } catch (err) {
    list.innerHTML = "<p style='color:red'>No se pudieron cargar tus deudas.</p>";
  }
}
cargarDeudas();

// --- Modal Agregar Deuda ---
const modal = document.getElementById("modal-deuda");
const openBtn = document.getElementById("add-deuda-btn");
const closeBtn = document.getElementById("close-modal-deuda");

const estadoSelect = document.getElementById("deuda-estado");
const recurrenteWrapper = document.getElementById("recurrente-wrapper");
const recurrenteSelect = document.getElementById("deuda-recurrente");
const frecuenciaWrapper = document.getElementById("frecuencia-wrapper");
const fechaLimiteWrapper = document.getElementById("fecha-limite-wrapper");
const fechaPagoWrapper = document.getElementById("fecha-pago-wrapper");
const fechaVencimientoWrapper = document.getElementById("fecha-vencimiento-wrapper");

// Mostrar/ocultar campos condicionales según flujo especificado
function actualizarCamposModal() {
  // Ocultar todo primero
  fechaLimiteWrapper.classList.add('hide');
  fechaPagoWrapper.classList.add('hide');
  fechaVencimientoWrapper.classList.add('hide');
  recurrenteWrapper.classList.add('hide');
  frecuenciaWrapper.classList.add('hide');

  const estado = estadoSelect.value;
  const recurrente = recurrenteSelect.value;

  if (estado === "PENDIENTE") {
    fechaLimiteWrapper.classList.remove('hide');
    recurrenteWrapper.classList.remove('hide');
    if (recurrente === "true") frecuenciaWrapper.classList.remove('hide');
  }
  else if (estado === "PAGADA") {
    fechaPagoWrapper.classList.remove('hide');
    recurrenteWrapper.classList.remove('hide');
    if (recurrente === "true") {
      frecuenciaWrapper.classList.remove('hide');
      fechaLimiteWrapper.classList.remove('hide'); // Mostrar fecha límite para recurrente
    }
  }
  else if (estado === "VENCIDA") {
    fechaVencimientoWrapper.classList.remove('hide');
    recurrenteWrapper.classList.remove('hide');
    if (recurrente === "true") {
      frecuenciaWrapper.classList.remove('hide');
      fechaLimiteWrapper.classList.remove('hide'); // Mostrar fecha límite para recurrente
    }
  }
}

// Listeners para lógica de campos condicionales
estadoSelect.addEventListener('change', () => {
  recurrenteSelect.value = "";
  actualizarCamposModal();
});
recurrenteSelect.addEventListener('change', actualizarCamposModal);

// Abrir modal, cargar categorías y limpiar campos
openBtn.onclick = function () {
  modal.classList.add("active");
  document.getElementById("deuda-form").reset();
  actualizarCamposModal();
  cargarCategoriasDeuda();
  setTimeout(() => document.getElementById("deuda-nombre").focus(), 200);
};
// Cerrar modal
closeBtn.onclick = function () {
  modal.classList.remove("active");
  document.getElementById("deuda-form").reset();
  actualizarCamposModal();
};
modal.addEventListener("mousedown", function (e) {
  if (e.target === modal) closeBtn.onclick();
});
window.addEventListener("keydown", function(e){
  if (e.key === "Escape" && modal.classList.contains("active")) closeBtn.onclick();
});

// --- Cargar categorías solo del usuario autenticado ---
async function cargarCategoriasDeuda() {
  const select = document.getElementById("deuda-categoria");
  select.innerHTML = "<option value=''>Cargando...</option>";
  try {
    const res = await fetch(`${API_BASE}/admin/categorias-deuda`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const categorias = await res.json();
    select.innerHTML = '<option value="">Selecciona una categoría</option>';
    categorias.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.nombre;
      opt.textContent = cat.nombre;
      select.appendChild(opt);
    });
  } catch {
    select.innerHTML = "<option value=''>Error al cargar categorías</option>";
  }
}

// --- Crear nueva categoría (NO enviar userId, el backend lo toma del token) ---
document.getElementById("btn-nueva-categoria").onclick = async function () {
  const nombre = prompt("Nueva categoría de deuda:");
  if (!nombre) return;
  try {
    const res = await fetch(`${API_BASE}/admin/categorias-deuda`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ nombre })
    });
    if (!res.ok) throw new Error();
    alert("¡Categoría creada!");
    cargarCategoriasDeuda();
  } catch {
    alert("Error al crear categoría");
  }
};

// --- Guardar nueva deuda (con validación de fechas) ---
document.getElementById("deuda-form").onsubmit = async function (e) {
  e.preventDefault();
  const errorDiv = document.getElementById("deuda-error-msg");
  errorDiv.textContent = "";
  errorDiv.style.display = "none";

  // Recoger campos básicos
  const estado = estadoSelect.value;
  const recurrente = recurrenteSelect.value;
  let body = {
    userId: userId,
    nombre: document.getElementById("deuda-nombre").value.trim(),
    categoriaNombre: document.getElementById("deuda-categoria").value.trim(),
    descripcion: document.getElementById("deuda-descripcion").value.trim(),
    monto: parseFloat(document.getElementById("deuda-monto").value),
    estado: estado
  };

  // Lógica de campos condicionales
  if (!body.nombre || !body.categoriaNombre || !body.monto || !body.estado) {
    errorDiv.textContent = "Todos los campos obligatorios deben estar completos.";
    errorDiv.style.display = "block";
    return;
  }

  // Validar fechas según estado (Evita guardar con fechas ilógicas)
  const today = new Date().toISOString().slice(0,10);

  if (estado === "PENDIENTE") {
    body.fechaLimitePago = document.getElementById("deuda-fecha-limite").value || null;
    body.recurrente = recurrente === "true";
    if (!body.fechaLimitePago) {
      errorDiv.textContent = "La fecha límite de pago es obligatoria.";
      errorDiv.style.display = "block";
      return;
    }
    // La fecha límite no puede ser antes de hoy
    if (body.fechaLimitePago < today) {
      errorDiv.textContent = "La fecha límite de pago no puede ser anterior a hoy.";
      errorDiv.style.display = "block";
      return;
    }
    if (recurrente === "true") {
      body.frecuencia = document.getElementById("deuda-frecuencia").value || null;
      if (!body.frecuencia) {
        errorDiv.textContent = "Completa la frecuencia de deuda.";
        errorDiv.style.display = "block";
        return;
      }
    }
  }
  if (estado === "PAGADA") {
    body.fechaPago = document.getElementById("deuda-fecha-pago").value || null;
    body.recurrente = recurrente === "true";
    if (!body.fechaPago) {
      errorDiv.textContent = "La fecha de pago es obligatoria.";
      errorDiv.style.display = "block";
      return;
    }
    // Fecha de pago NO puede ser después de hoy
    if (body.fechaPago > today) {
      errorDiv.textContent = "La fecha de pago no puede ser posterior a hoy.";
      errorDiv.style.display = "block";
      return;
    }
    if (recurrente === "true") {
      body.fechaLimitePago = document.getElementById("deuda-fecha-limite").value || null;
      if (!body.fechaLimitePago) {
        errorDiv.textContent = "La fecha límite de pago es obligatoria para deudas pagadas recurrentes.";
        errorDiv.style.display = "block";
        return;
      }
      body.frecuencia = document.getElementById("deuda-frecuencia").value || null;
      if (!body.frecuencia) {
        errorDiv.textContent = "Completa la frecuencia de deuda.";
        errorDiv.style.display = "block";
        return;
      }
    }
  }
  if (estado === "VENCIDA") {
    body.fechaVencimiento = document.getElementById("deuda-fecha-vencimiento").value || null;
    body.recurrente = recurrente === "true";
    if (!body.fechaVencimiento) {
      errorDiv.textContent = "La fecha de vencimiento es obligatoria.";
      errorDiv.style.display = "block";
      return;
    }
    // Fecha de vencimiento NO puede ser después de hoy
    if (body.fechaVencimiento > today) {
      errorDiv.textContent = "La fecha de vencimiento no puede ser posterior a hoy.";
      errorDiv.style.display = "block";
      return;
    }
    if (recurrente === "true") {
      body.fechaLimitePago = document.getElementById("deuda-fecha-limite").value || null;
      if (!body.fechaLimitePago) {
        errorDiv.textContent = "La fecha límite de pago es obligatoria para deudas vencidas recurrentes.";
        errorDiv.style.display = "block";
        return;
      }
      body.frecuencia = document.getElementById("deuda-frecuencia").value || null;
      if (!body.frecuencia) {
        errorDiv.textContent = "Completa la frecuencia de deuda.";
        errorDiv.style.display = "block";
        return;
      }
    }
  }

  // ENVÍO
  try {
    const res = await fetch(`${API_BASE}/deudas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch {}
      errorDiv.textContent = data.message || "Error al guardar la deuda.";
      errorDiv.style.display = "block";
      return;
    }
    modal.classList.remove("active");
    alert("¡Deuda registrada correctamente!");
    document.getElementById("deuda-form").reset();
    actualizarCamposModal();
    cargarDeudas();
  } catch (err) {
    errorDiv.textContent = "Error al conectar con el servidor.";
    errorDiv.style.display = "block";
  }
};

// --- Placeholder: cargar pagos, alertas, perfil ---
document.getElementById("pagos-list").innerHTML = "<i>(Pendiente de implementar)</i>";
document.getElementById("alertas-list").innerHTML = "<i>(Pendiente de implementar)</i>";
document.getElementById("perfil-info").innerHTML = "<i>(Pendiente de implementar)</i>";