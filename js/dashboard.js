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

// URL API REMOTA
const API_BASE = "https://rememberdebts-api.onrender.com/api/v1";

// --- Estado global ---
let todasLasDeudas = [];
let categoriasSet = new Set();
let todosLosPagos = [];
let deudasParaPagosFiltro = [];

// ----------- NAVEGACIÓN DE MESES -----------
let mesSeleccionado = new Date();
function mostrarMesSeleccionado() {
  const span = document.getElementById("mes-actual");
  span.textContent = mesSeleccionado.toLocaleString("es-PE", {month:"long", year:"numeric"});
}
document.addEventListener("DOMContentLoaded", () => {
  mostrarMesSeleccionado();
});

document.getElementById("mes-anterior").onclick = function() {
  mesSeleccionado.setMonth(mesSeleccionado.getMonth() - 1);
  mostrarMesSeleccionado();
  mostrarDeudasFiltradas();
};
document.getElementById("mes-siguiente").onclick = function() {
  mesSeleccionado.setMonth(mesSeleccionado.getMonth() + 1);
  mostrarMesSeleccionado();
  mostrarDeudasFiltradas();
};

// --- Cargar deudas (guardar todas para filtrado rápido) ---
async function cargarDeudas() {
  const tbody = document.getElementById("deudas-list");
  tbody.innerHTML = "<tr><td colspan='10' style='color:#888;'>Cargando...</td></tr>";
  try {
    const res = await fetch(`${API_BASE}/deudas/usuario/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al cargar deudas");
    todasLasDeudas = await res.json();
    // Actualiza categorías para filtros
    categoriasSet = new Set();
    (todasLasDeudas || []).forEach(deuda => {
      if (deuda.categoriaNombre) categoriasSet.add(deuda.categoriaNombre);
    });
    actualizarOpcionesFiltroCategorias();
    mostrarDeudasFiltradas();
  } catch (err) {
    tbody.innerHTML = "<tr><td colspan='10' style='color:red'>No se pudieron cargar tus deudas.</td></tr>";
  }
}

// --- Opciones dinámicas para filtro de categoría ---
function actualizarOpcionesFiltroCategorias() {
  const select = document.getElementById("filtro-categoria");
  const actual = select.value;
  select.innerHTML = '<option value="">Categoría (todas)</option>';
  Array.from(categoriasSet).sort().forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  select.value = actual; // mantén selección
}

// --- Filtrado de deudas (Estado, Categoría, Búsqueda y Mes) ---
function mostrarDeudasFiltradas() {
  const estado = document.getElementById("filtro-estado").value;
  const categoria = document.getElementById("filtro-categoria").value;
  const texto = document.getElementById("filtro-busqueda").value.trim().toLowerCase();
  const tbody = document.getElementById("deudas-list");
  let deudasFiltradas = [...todasLasDeudas];

  // --- Filtro por mes seleccionado (si hay navegación)
  const mes = mesSeleccionado.getMonth();
  const anio = mesSeleccionado.getFullYear();

  deudasFiltradas = deudasFiltradas.filter(d => {
    // Referencia: fechaLimitePago, fechaVencimiento, fechaPago
    let fechaReferencia = d.fechaLimitePago || d.fechaVencimiento || d.fechaPago;
    if (!fechaReferencia) return false;
    let fecha = new Date(fechaReferencia);
    return fecha.getMonth() === mes && fecha.getFullYear() === anio;
  });

  // --- Aplica filtros de estado/categoría/búsqueda
  if (estado) deudasFiltradas = deudasFiltradas.filter(d => d.estado === estado);
  if (categoria) deudasFiltradas = deudasFiltradas.filter(d => d.categoriaNombre === categoria);
  if (texto) {
    deudasFiltradas = deudasFiltradas.filter(d =>
      (d.nombre && d.nombre.toLowerCase().includes(texto)) ||
      (d.descripcion && d.descripcion.toLowerCase().includes(texto))
    );
  }

  // --- Ordena: pagadas al final ---
  let deudasPagadas = deudasFiltradas.filter(d => d.estado === "PAGADA");
  let deudasNoPagadas = deudasFiltradas.filter(d => d.estado !== "PAGADA");
  deudasFiltradas = [...deudasNoPagadas, ...deudasPagadas];

  tbody.innerHTML = "";
  if (!deudasFiltradas || deudasFiltradas.length === 0) {
    tbody.innerHTML = "<tr><td colspan='10'>No hay deudas que coincidan con el filtro.</td></tr>";
    return;
  }

  // Función para saber si una fecha cae en esta semana
  function esEstaSemana(fechaISO) {
    if (!fechaISO) return false;
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const finSemana = new Date(hoy);
    finSemana.setDate(hoy.getDate() + (6 - hoy.getDay()));
    inicioSemana.setHours(0,0,0,0);
    finSemana.setHours(23,59,59,999);
    return fecha >= inicioSemana && fecha <= finSemana;
  }

  deudasFiltradas.forEach(deuda => {
    let tr = document.createElement("tr");
    if (deuda.estado === "VENCIDA" && (!deuda.fechaPago || deuda.fechaPago === "")) {
      tr.classList.add("deuda-vencida-roja");
    } else if (deuda.estado === "PENDIENTE" && esEstaSemana(deuda.fechaLimitePago)) {
      tr.classList.add("deuda-pendiente-amarilla");
    }
    tr.innerHTML = `
      <td data-label="Nombre"><b>${deuda.nombre || ""}</b></td>
      <td data-label="Categoría">${deuda.categoriaNombre || ""}</td>
      <td data-label="Descripción">${deuda.descripcion || ""}</td>
      <td data-label="Monto">S/ ${deuda.monto?.toFixed(2) || ""}</td>
      <td data-label="Estado">${deuda.estado || ""}</td>
      <td data-label="Recurrente">${deuda.recurrente ? "Sí" : "No"}</td>
      <td data-label="Frecuencia">${deuda.frecuencia || ""}</td>
      <td data-label="Fecha límite">${deuda.fechaLimitePago || ""}</td>
      <td data-label="Fecha pago">${deuda.fechaPago || ""}</td>
      <td data-label="Fecha vencimiento">${deuda.fechaVencimiento || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Listeners filtros y navegación
document.addEventListener("DOMContentLoaded", function() {
  ["filtro-estado", "filtro-categoria", "filtro-busqueda"].forEach(id => {
    document.getElementById(id).addEventListener("input", mostrarDeudasFiltradas);
  });
  document.getElementById("btn-limpiar-filtros").onclick = function() {
    document.getElementById("filtro-estado").value = "";
    document.getElementById("filtro-categoria").value = "";
    document.getElementById("filtro-busqueda").value = "";
    mostrarDeudasFiltradas();
  };
  ["filtro-pago-deuda", "filtro-pago-desde", "filtro-pago-hasta", "filtro-pago-nota"].forEach(id => {
    document.getElementById(id).addEventListener("input", mostrarPagosFiltrados);
  });
  document.getElementById("btn-limpiar-filtros-pago").onclick = function() {
    document.getElementById("filtro-pago-deuda").value = "";
    document.getElementById("filtro-pago-desde").value = "";
    document.getElementById("filtro-pago-hasta").value = "";
    document.getElementById("filtro-pago-nota").value = "";
    mostrarPagosFiltrados();
  };
});

// ----------- RESTO de tu código original (modal, categorías, guardar, etc.) ------------

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

function actualizarCamposModal() {
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
      fechaLimiteWrapper.classList.remove('hide');
    }
  }
  else if (estado === "VENCIDA") {
    fechaVencimientoWrapper.classList.remove('hide');
    recurrenteWrapper.classList.remove('hide');
    if (recurrente === "true") {
      frecuenciaWrapper.classList.remove('hide');
      fechaLimiteWrapper.classList.remove('hide');
    }
  }
}
estadoSelect.addEventListener('change', () => {
  recurrenteSelect.value = "";
  actualizarCamposModal();
});
recurrenteSelect.addEventListener('change', actualizarCamposModal);

openBtn.onclick = function () {
  modal.classList.add("active");
  document.getElementById("deuda-form").reset();
  actualizarCamposModal();
  cargarCategoriasDeuda();
  setTimeout(() => document.getElementById("deuda-nombre").focus(), 200);
};
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
    cargarDeudas(); // recarga deudas para actualizar filtros
  } catch {
    alert("Error al crear categoría");
  }
};
document.getElementById("deuda-form").onsubmit = async function (e) {
  e.preventDefault();
  const errorDiv = document.getElementById("deuda-error-msg");
  errorDiv.textContent = "";
  errorDiv.style.display = "none";
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
  if (!body.nombre || !body.categoriaNombre || !body.monto || !body.estado) {
    errorDiv.textContent = "Todos los campos obligatorios deben estar completos.";
    errorDiv.style.display = "block";
    return;
  }
  const today = new Date().toISOString().slice(0,10);
  if (estado === "PENDIENTE") {
    body.fechaLimitePago = document.getElementById("deuda-fecha-limite").value || null;
    body.recurrente = recurrente === "true";
    if (!body.fechaLimitePago) {
      errorDiv.textContent = "La fecha límite de pago es obligatoria.";
      errorDiv.style.display = "block";
      return;
    }
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

// --- Placeholder: cargar alertas y perfil ---
document.getElementById("alertas-list").innerHTML = "<i>(Pendiente de implementar)</i>";
document.getElementById("perfil-info").innerHTML = "<i>(Pendiente de implementar)</i>";

// ================= PAGOS =======================

// ELEMENTOS
const pagosList = document.getElementById("pagos-list");
const addPagoBtn = document.getElementById("add-pago-btn");
const modalPago = document.getElementById("modal-pago");
const closeModalPago = document.getElementById("close-modal-pago");
const pagoForm = document.getElementById("pago-form");
const pagoDeudaSelect = document.getElementById("pago-deuda");
const pagoComprobanteInput = document.getElementById("pago-comprobante");
const pagoErrorMsg = document.getElementById("pago-error-msg");
const pagoMontoInput = document.getElementById("pago-monto");

let deudasPendientes = []; // Cache de deudas pendientes/vencidas

// --- Cargar pagos ---
async function cargarPagos() {
  pagosList.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
  try {
    // Obtén los pagos de todas las deudas del usuario
    const resDeudas = await fetch(`${API_BASE}/deudas/usuario/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const deudas = await resDeudas.json();
    const deudaIds = deudas.map(d => d.id);
    deudasParaPagosFiltro = deudas; // Guarda para el select de filtro

    let pagosTotales = [];
    for (let deudaId of deudaIds) {
      const resPagos = await fetch(`${API_BASE}/admin/pagos/deuda/${deudaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resPagos.ok) continue;
      const pagos = await resPagos.json();
      pagosTotales = pagosTotales.concat(
        pagos.map(p => ({
          ...p,
          deudaNombre: deudas.find(d => d.id === deudaId)?.nombre || "",
          deudaId: deudaId // Importante para filtro
        }))
      );
    }

    todosLosPagos = pagosTotales; // <-- Guardamos todos para filtros
    actualizarOpcionesFiltroPagos();
    mostrarPagosFiltrados();

  } catch (err) {
    pagosList.innerHTML = "<tr><td colspan='5'>Error al cargar pagos.</td></tr>";
  }
}

// --- Cargar deudas pendientes/vencidas para registrar pago ---
async function cargarDeudasPendientes() {
  pagoDeudaSelect.innerHTML = "<option value=''>Cargando...</option>";
  pagoMontoInput.value = "";
  try {
    const res = await fetch(`${API_BASE}/deudas/usuario/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const deudas = await res.json();
    deudasPendientes = deudas.filter(d =>
      d.estado === "PENDIENTE" || d.estado === "VENCIDA"
    );
    if (deudasPendientes.length === 0) {
      pagoDeudaSelect.innerHTML = "<option value=''>No hay deudas pendientes o vencidas</option>";
      pagoMontoInput.value = "";
      return;
    }
    pagoDeudaSelect.innerHTML = '<option value="">Selecciona deuda</option>';
    deudasPendientes.forEach(deuda => {
      pagoDeudaSelect.innerHTML += `<option value="${deuda.id}" data-monto="${deuda.monto}">${deuda.nombre} (${deuda.estado})</option>`;
    });
    pagoMontoInput.value = "";
  } catch {
    pagoDeudaSelect.innerHTML = "<option value=''>Error al cargar deudas</option>";
    pagoMontoInput.value = "";
  }
}

// Al cambiar la deuda, coloca el monto fijo y no editable
pagoDeudaSelect.addEventListener("change", function () {
  const selectedId = this.value;
  const deuda = deudasPendientes.find(d => d.id == selectedId);
  pagoMontoInput.value = deuda ? deuda.monto.toFixed(2) : "";
});

// --- Abrir y cerrar modal ---
addPagoBtn.onclick = () => {
  modalPago.classList.add("active");
  pagoForm.reset();
  cargarDeudasPendientes();
  pagoErrorMsg.textContent = "";
  pagoErrorMsg.style.display = "none";
  pagoMontoInput.value = ""; // Reinicia el monto
};

closeModalPago.onclick = () => {
  modalPago.classList.remove("active");
  pagoForm.reset();
  pagoMontoInput.value = "";
};

modalPago.addEventListener("mousedown", e => {
  if (e.target === modalPago) closeModalPago.onclick();
});
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && modalPago.classList.contains("active")) closeModalPago.onclick();
});

// --- Registrar nuevo pago ---
pagoForm.onsubmit = async function (e) {
  e.preventDefault();
  pagoErrorMsg.style.display = "none";
  const deudaId = pagoDeudaSelect.value;
  const fechaPago = document.getElementById("pago-fecha").value;
  const montoPagado = parseFloat(pagoMontoInput.value);
  const notas = document.getElementById("pago-notas").value;
  const comprobante = pagoComprobanteInput.files[0];

  // Validación básica
  if (!deudaId || !fechaPago || !montoPagado || !comprobante) {
    pagoErrorMsg.textContent = "Todos los campos son obligatorios (incluye el comprobante).";
    pagoErrorMsg.style.display = "block";
    return;
  }

  try {
    // ENVÍO CORRECTO SEGÚN SPRING BOOT
    const pago = {
      deudaId: deudaId,
      fechaPago: fechaPago,
      montoPagado: montoPagado,
      notas: notas
    };
    const formData = new FormData();
    formData.append("pago", new Blob([JSON.stringify(pago)], { type: "application/json" }));
    formData.append("comprobante", comprobante);

    const res = await fetch(`${API_BASE}/admin/pagos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      pagoErrorMsg.textContent = data.message || "Error al registrar el pago.";
      pagoErrorMsg.style.display = "block";
      return;
    }
    modalPago.classList.remove("active");
    pagoForm.reset();
    cargarPagos();
    alert("¡Pago registrado correctamente!");
    cargarDeudas(); // Actualiza deudas, por si el pago afecta su estado
  } catch (err) {
    pagoErrorMsg.textContent = "Error al conectar con el servidor.";
    pagoErrorMsg.style.display = "block";
  }
};

function actualizarOpcionesFiltroPagos() {
  const select = document.getElementById("filtro-pago-deuda");
  const actual = select.value;
  select.innerHTML = '<option value="">Deuda (todas)</option>';
  deudasParaPagosFiltro.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.nombre;
    select.appendChild(opt);
  });
  select.value = actual;
}

function mostrarPagosFiltrados() {
  const deudaId = document.getElementById("filtro-pago-deuda").value;
  const desde = document.getElementById("filtro-pago-desde").value;
  const hasta = document.getElementById("filtro-pago-hasta").value;
  const nota = document.getElementById("filtro-pago-nota").value.toLowerCase();

  let pagosFiltrados = [...todosLosPagos];
  if (deudaId) pagosFiltrados = pagosFiltrados.filter(p => p.deudaId == deudaId);
  if (desde) pagosFiltrados = pagosFiltrados.filter(p => p.fechaPago && p.fechaPago >= desde);
  if (hasta) pagosFiltrados = pagosFiltrados.filter(p => p.fechaPago && p.fechaPago <= hasta);
  if (nota) pagosFiltrados = pagosFiltrados.filter(p => (p.notas || "").toLowerCase().includes(nota));

  pagosList.innerHTML = "";
  if (!pagosFiltrados.length) {
    pagosList.innerHTML = "<tr><td colspan='5'>No hay pagos que coincidan con el filtro.</td></tr>";
    return;
  }
  pagosFiltrados.forEach(pago => {
    pagosList.innerHTML += `
      <tr>
        <td>${pago.deudaNombre}</td>
        <td>S/ ${pago.montoPagado?.toFixed(2) || ""}</td>
        <td>${pago.fechaPago || ""}</td>
        <td>${pago.notas || ""}</td>
        <td>
          ${pago.comprobanteUrl
            ? `<a href="${pago.comprobanteUrl}" target="_blank" rel="noopener" class="pago-comprobante-link">Ver</a>`
            : "(Sin archivo)"}
        </td>
      </tr>
    `;
  });
}

// --- Carga inicial de deudas y pagos ---
cargarDeudas();
cargarPagos();
