const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// FILTRO DE SEGURIDAD
const bannedWords = ["pornografía infantil", "cp", "enlace-peligroso.com"]; 

async function enviarSecreto() {
    const texto = input.value.trim();

    // Validar que no esté vacío
    if(!texto) return alert("Escribe algo, no seas tímido.");

    // Filtro de palabras prohibidas e links
    const tieneIlegal = bannedWords.some(palabra => texto.toLowerCase().includes(palabra));
    const tieneLink = /(http|https|www)/i.test(texto);

    if (tieneIlegal || tieneLink) {
        return alert("Contenido prohibido o links no permitidos.");
    }

    // Enviar a Supabase (Tabla: secretos, Columna: contenido)
    const { data, error } = await supabase
        .from('secretos')
        .insert([{ contenido: texto }]);

    if (error) {
        console.error(error);
    } else {
        input.value = "";
        leerSecretos(); // Recargar lista
    }
}

async function leerSecretos() {
    const { data: secretos, error } = await supabase
        .from('secretos')
        .select('*')
        .order('created_at', { ascending: false });

    if (secretos) {
        container.innerHTML = secretos.map(s => `
            <div class="card">
                <p>${s.contenido}</p>
                <small>${new Date(s.created_at).toLocaleString()}</small>
            </div>
        `).join('');
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
