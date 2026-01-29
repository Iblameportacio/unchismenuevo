const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";

// Aquí estaba el lío: usamos _supabase para no chocar con la librería
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// FILTRO DE SEGURIDAD
const bannedWords = ["pornografía infantil", "cp", "enlace-peligroso.com"]; 

async function enviarSecreto() {
    const texto = input.value.trim();

    if(!texto) return alert("Escribe algo, no seas tímido.");

    const tieneIlegal = bannedWords.some(palabra => texto.toLowerCase().includes(palabra));
    const tieneLink = /(http|https|www)/i.test(texto);

    if (tieneIlegal || tieneLink) {
        return alert("Contenido prohibido o links no permitidos.");
    }

    // Cambiado supabase por _supabase
    const { data, error } = await _supabase
        .from('secretos')
        .insert([{ contenido: texto }]);

    if (error) {
        console.error("Error al enviar:", error);
        alert("Hubo un error al publicar. Revisa las políticas de Supabase.");
    } else {
        input.value = "";
        leerSecretos(); 
    }
}

async function leerSecretos() {
    // Cambiado supabase por _supabase
    const { data: secretos, error } = await _supabase
        .from('secretos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al leer:", error);
    }

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
btn.onclick = enviarSecreto;
leerSecretos();
