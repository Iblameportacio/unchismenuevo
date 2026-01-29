const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// Lógica del Modal de Políticas
const modal = document.getElementById('modal-politicas');
const btnAceptar = document.getElementById('btn-aceptar');
const btnRechazar = document.getElementById('btn-rechazar');

if (localStorage.getItem('politicasAceptadas') === 'true') {
    modal.style.display = 'none';
}

btnAceptar.onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

btnRechazar.onclick = () => {
    alert("Para usar el sitio debes aceptar las políticas.");
    window.location.href = "https://google.com";
};

// FILTRO
const bannedWords = ["pornografía infantil", "cp", "enlace-peligroso.com"]; 

async function reaccionar(id, valorActual, columna) {
    const nuevaData = {};
    nuevaData[columna] = (valorActual || 0) + 1;
    await _supabase.from('secretos').update(nuevaData).eq('id', id);
    leerSecretos();
}

async function enviarSecreto() {
    const texto = input.value.trim();
    if(!texto) return alert("Escribe algo...");

    const tieneIlegal = bannedWords.some(p => texto.toLowerCase().includes(p));
    if (tieneIlegal || /(http|https|www)/i.test(texto)) return alert("Contenido no permitido.");

    const { error } = await _supabase.from('secretos').insert([{ contenido: texto, likes: 0, dislikes: 0 }]);
    if (error) console.error(error);
    else { input.value = ""; leerSecretos(); }
}

async function leerSecretos() {
    const { data: secretos } = await _supabase.from('secretos').select('*').order('created_at', { ascending: false });
    if (secretos) {
        container.innerHTML = secretos.map(s => `
            <div class="card">
                <p>${s.contenido}</p>
                <div class="footer-card">
                    <small>${new Date(s.created_at).toLocaleDateString()}</small>
                    <div class="actions">
                        <button class="like-btn" onclick="reaccionar(${s.id}, ${s.likes}, 'likes')">🔥 ${s.likes || 0}</button>
                        <button class="dislike-btn" onclick="reaccionar(${s.id}, ${s.dislikes}, 'dislikes')">💩 ${s.dislikes || 0}</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
