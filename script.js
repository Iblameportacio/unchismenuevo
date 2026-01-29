const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// --- LÓGICA DEL MODAL ---
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
    window.location.href = "https://google.com";
};

// --- REACCIONES ---
async function reaccionar(id, valorActual, columna) {
    if (localStorage.getItem(`voto_${id}`)) return alert("Ya reaccionaste, broski.");

    const { error } = await _supabase
        .from('secretos')
        .update({ [columna]: (valorActual || 0) + 1 })
        .eq('id', id);

    if (!error) {
        localStorage.setItem(`voto_${id}`, 'true');
        await leerSecretos();
    }
}

// --- ENVIAR ---
async function enviarSecreto() {
    const texto = input.value.trim();
    const captchaRes = turnstile.getResponse();
    
    if (!captchaRes) return alert("Completa el captcha.");
    if (!texto) return alert("Escribe algo...");

    btn.disabled = true;
    btn.innerText = "Publicando...";

    const { error } = await _supabase
        .from('secretos')
        .insert([{ contenido: texto, likes: 0, dislikes: 0 }]);

    if (!error) {
        input.value = "";
        turnstile.reset();
        await leerSecretos();
    }
    
    btn.disabled = false;
    btn.innerText = "Publicar";
}

// --- LEER CHISMES CON ANUNCIOS INYECTADOS ---
async function leerSecretos() {
    const { data: secretos } = await _supabase
        .from('secretos')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (secretos) {
        let htmlFinal = "";
        
        secretos.forEach((s, index) => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            
            // Render chisme normal
            htmlFinal += `
                <div class="card">
                    <p>${s.contenido}</p>
                    <div class="footer-card">
                        <small>${new Date(s.created_at).toLocaleString()}</small>
                        <div class="actions">
                            <button class="like-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.likes}, 'likes')">🔥 ${s.likes || 0}</button>
                            <button class="dislike-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.dislikes}, 'dislikes')">💩 ${s.dislikes || 0}</button>
                        </div>
                    </div>
                </div>`;

            // --- INYECTAR ANUNCIO NATIVE CADA 3 CHISMES ---
            if ((index + 1) % 3 === 0) {
                htmlFinal += `
                    <div class="ad-inline" style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center; background: #0a0a0a;">
                        <small style="color: #71767b; display: block; margin-bottom: 10px; font-size: 10px;">PUBLICIDAD</small>
                        
                        <script async="async" data-cfasync="false" src="//pl16441576.highrevenuegate.com/22e5c3e32301ad5e2fdcfd392d705a30/invoke.js"></script>
                        <div id="container-22e5c3e32301ad5e2fdcfd392d705a30"></div>
                        
                    </div>`;
            }
        });

        container.innerHTML = htmlFinal;
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
