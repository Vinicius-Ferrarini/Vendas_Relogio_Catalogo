// script.js (OTIMIZADO + SKELETON + ID ESTÁVEL + ORDEM DINÂMICA DA PLANILHA)

// ======= CONFIG DA PÁGINA =======
const SHEET_ID = "1gU34_gLsxTHDy_nxhtg91-Ld6VaU4Zba65dBkZD-2aQ";
const GID = 0;
// ======================

let activeTimers = {};
let allProducts = new Map();
let dynamicCategories = new Map();
let currentSortOrder = 'default';

let mainElement, navElement, listaOfertasEl, secaoOfertasEl;
let filtroPesquisa, filtroCategoria, filtroGenero, filtroTipoContainer, precoMin, precoMax;
let btnLimparFiltros, btnSortAsc, btnSortDesc;

// Variáveis globais para o filtro sanfona
let toggleFiltersButton, filtersSectionContainer;

// ===================================
// FUNÇÕES AUXILIARES (Específicas da página)
// ===================================
function removerAcentos(str) { return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

// ===================================
// SLUGIFY (Cria ID estável a partir do nome)
// ===================================
function slugify(text) {
    if (!text) {
        return `produto-sem-nome-${Date.now()}`;
    }
    return removerAcentos(text.toLowerCase().trim())
        .replace(/\s+/g, '-')           
        .replace(/[^\w\-]+/g, '')       
        .replace(/\-\-+/g, '-');      
}

// ===================================
// SKELETON LOADER
// ===================================
function showSkeletonLoaders(containerEl, count = 5) {
    if (!containerEl) return;
    vazioElemento(containerEl); 

    const skeletonHTML = `
        <div class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-price"></div>
            <div class="skeleton-button"></div>
        </div>
    `;
    
    for (let i = 0; i < count; i++) {
        containerEl.innerHTML += skeletonHTML;
    }
}

// ===================================
// LÓGICA DE CARREGAMENTO DA PLANILHA
// ===================================
async function fetchSheetJson(sheetId, gid = 0) { const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`; const res = await fetch(url); const txt = await res.text(); const start = txt.indexOf('('); const end = txt.lastIndexOf(')'); const jsonStr = txt.substring(start + 1, end); return JSON.parse(jsonStr); }

function mapRowToProduct(row, headers) {
    const obj = { images: [], ativo: true };
    headers.forEach((h, i) => { const cell = row[i]; const val = cell && cell.v !== undefined ? cell.v : ""; const header = (h || "").toString().trim().toLowerCase();
        if (header.match(/^id$/)) obj.id = val; else if (header.match(/nome|name|produto/)) obj.nome = val; else if (header.match(/pre[cç]o[ \-]?oferta/)) { if (typeof val === "number") { obj.precoOferta = val; } else { const cleaned = String(val).replace(/[R$\s.]/g, "").replace(",", "."); const n = parseFloat(cleaned); if (!isNaN(n) && n > 0) { obj.precoOferta = n; } } } else if (header.match(/pre[cç]o|price|valor/)) { if (typeof val === "number") { obj.preco = val; } else { const cleaned = String(val).replace(/[R$\s.]/g, "").replace(",", "."); const n = parseFloat(cleaned); obj.preco = isNaN(n) ? 0 : n; } } else if (header.match(/categoria|category/)) obj.categoria = val.toString().toLowerCase(); else if (header.match(/tipo|type/)) obj.tipo = val.toString().toLowerCase(); else if (header.match(/genero|gênero|genêro|sex|sexo/)) obj.genero = val.toString().toLowerCase(); else if (header.match(/destaque/)) obj.destaque = val; else if (header.match(/descricao|descri[cç][aã]o/)) obj.descricao = val; else if (header.match(/dataoferta/)) { if (cell && cell.f) obj.dataOferta = cell.f; else if (val && val.toString().includes('/')) obj.dataOferta = val.toString(); else obj.dataOferta = ""; } else if (header.match(/horaoferta/)) obj.horaOferta = val; else if (header.match(/^img\d?$|^imagem\d?$|^foto\d?$/)) { if (val) obj.images.push(val.toString()); } else if (header.match(/^ativo$/)) { obj.ativo = !(String(val).trim().toUpperCase() === 'N'); }
    });
    obj.nome = obj.nome || ""; obj.preco = obj.preco !== undefined ? obj.preco : 0; obj.categoria = obj.categoria || "outros"; obj.tipo = obj.tipo || ""; obj.genero = obj.genero || ""; 
    
    if (obj.id) {
        obj.id = obj.id.toString();
    } else {
        obj.id = slugify(obj.nome);
    }
    
    obj.oferta = (obj.destaque && obj.destaque !== "") || (obj.dataOferta && obj.dataOferta !== ""); if (obj.images.length === 0) { obj.images.push("https://via.placeholder.com/800x800?text=Sem+Imagem"); }
    obj.precoOriginal = obj.preco;
    if (obj.precoOferta !== undefined && obj.precoOferta < obj.preco) {
        let ofertaExpiradaNaCarga = false;
        if (obj.dataOferta) {
            const [dia, mes, anoStr] = obj.dataOferta.split('/');
            if (dia && mes && anoStr) {
                const hora = obj.horaOferta ? parseInt(obj.horaOferta, 10) : 23;
                const minutos = obj.horaOferta ? 0 : 59;
                const segundos = obj.horaOferta ? 0 : 59;
                let anoNum = parseInt(anoStr, 10);
                if (anoStr.length === 2) anoNum += 2000;
                const targetDate = new Date(anoNum, mes - 1, dia, hora, minutos, segundos);
                if (targetDate.getTime() < Date.now()) {
                    ofertaExpiradaNaCarga = true;
                }
            }
        }
        if (!ofertaExpiradaNaCarga) {
            obj.precoOriginal = obj.preco; 
            obj.preco = obj.precoOferta;   
            obj.oferta = true;            
        } else {
             obj.oferta = false; 
        }
    } else {
         obj.precoOriginal = obj.preco;
    }
    return obj;
}

function parseGvizResponse(resp) {
    const cols = resp.table.cols.map(c => c.label || c.id || ""); const rows = resp.table.rows || []; const produtos = rows.map(r => mapRowToProduct(r.c, cols)).filter(p => p.ativo);
    allProducts.clear(); 
    dynamicCategories.clear(); // O Map preserva a ordem de inserção!
    
    produtos.forEach(p => { 
        allProducts.set(p.id, p); 
        // Se a categoria aparece pela primeira vez na planilha, ela é salva no Map nessa ordem
        if (!dynamicCategories.has(p.categoria)) { 
            dynamicCategories.set(p.categoria, { tipos: new Set(), generos: new Set(), containerId: `lista-${p.categoria}`, sectionId: `secao-${p.categoria}`, sectionEl: null, containerEl: null }); 
        } 
        const catData = dynamicCategories.get(p.categoria); 
        
        if (p.tipo) catData.tipos.add(p.tipo); 
        if (p.genero) catData.generos.add(p.genero); 
    });
    
    return produtos;
}

function popularDropdown(selectElement, optionsSet, placeholder) {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`; Array.from(optionsSet).sort().forEach(option => { const opt = document.createElement('option'); opt.value = option; opt.textContent = option.charAt(0).toUpperCase() + option.slice(1); selectElement.appendChild(opt); });
}

function criarCheckboxesTipo(containerElement, tiposSet) {
    vazioElemento(containerElement); const titleSpan = document.createElement('span'); titleSpan.className = 'checkboxes-title'; titleSpan.textContent = 'Tipos:'; containerElement.appendChild(titleSpan);
    Array.from(tiposSet).sort().forEach(tipo => { const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = tipo; checkbox.addEventListener('change', filtrarEExibirProdutos); label.appendChild(checkbox); label.appendChild(document.createTextNode(` ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)); containerElement.appendChild(label); });
}

// ===================================
// ATUALIZADO: ORDEM DINÂMICA (DA PLANILHA)
// ===================================
function criarSecoesCategorias() {
    vazioElemento(navElement);
    Array.from(mainElement.querySelectorAll('.secao-categoria')).forEach(el => el.remove());
    
    const navOfertas = document.createElement('a'); 
    navOfertas.href = "#secao-ofertas"; 
    navOfertas.textContent = "Ofertas"; 
    navElement.appendChild(navOfertas);
    
    // ATUALIZADO: Sem .sort(), usamos a ordem natural de inserção do Map (que vem da planilha)
    const categoriasOrdenadas = Array.from(dynamicCategories.keys());
    
    for (const categoria of categoriasOrdenadas) {
        const catData = dynamicCategories.get(categoria);
        const sectionEl = document.createElement('div'); sectionEl.id = catData.sectionId; sectionEl.className = 'secao-categoria'; const titleEl = document.createElement('h2'); titleEl.className = 'titulo-secao'; titleEl.textContent = categoria.charAt(0).toUpperCase() + categoria.slice(1); const containerEl = document.createElement('div'); containerEl.className = 'container'; containerEl.id = catData.containerId; 
        
        showSkeletonLoaders(containerEl, 5); 
        
        sectionEl.appendChild(titleEl); sectionEl.appendChild(containerEl); mainElement.appendChild(sectionEl); catData.sectionEl = sectionEl; catData.containerEl = containerEl;
        const navLink = document.createElement('a'); navLink.href = `#${catData.sectionId}`; navLink.textContent = categoria.charAt(0).toUpperCase() + categoria.slice(1); navElement.appendChild(navLink);
    }
}

// ===================================
// RENDERIZAÇÃO DE CARDS E TIMERS
// ===================================
function criarCardHTML(p) {
    const placeholder = "https://via.placeholder.com/800x800?text=Sem+Imagem"; const images = p.images && p.images.length ? p.images : [placeholder]; const mainImg = images[0]; const thumbnails = images.slice(0, 4); const thumbsHTML = thumbnails.map(img => `<img src="${escapeHtml(img)}" alt="Miniatura" class="card-thumb" loading="lazy">`).join('');
    const precoFmt = formatPrice(p.preco);
    const precoOriginalFmt = (p.precoOriginal && p.precoOriginal !== p.preco && p.oferta)
                            ? `<span class="preco-original">${formatPrice(p.precoOriginal)}</span>`
                            : '';
    const linkDetalhe = `detalhe.html?data=${encodeURIComponent(JSON.stringify(p))}`;
    const badgeHTML = p.oferta && p.destaque ? `<div class="card-badge">${escapeHtml(p.destaque)}</div>` : '';
    const timerHTML = p.oferta && p.dataOferta ? `<div class="card-timer" data-timer-id="${p.id}"></div>` : '';
    const cart = getCart(); 
    const isInCart = cart.find(item => item.id.toString() === p.id.toString()); 
    const btnText = isInCart ? '✅ Já no carrinho' : 'Adicionar ao Carrinho'; 
    const btnDisabled = isInCart ? 'disabled' : '';
    
    const template = document.createElement('div'); template.className = "card"; template.innerHTML = `${badgeHTML}${timerHTML}<div class="card-img-main"><a href="${linkDetalhe}"><img src="${escapeHtml(mainImg)}" alt="${escapeHtml(p.nome)}" loading="lazy" class="card-img-main-pic"></a></div><div class="card-img-thumbs">${thumbsHTML}</div><h3>${escapeHtml(p.nome)}</h3><p class="preco-container">${precoOriginalFmt}<span class="preco-atual">${precoFmt}</span></p><button class="btn-add-cart" data-id="${escapeHtml(p.id)}" ${btnDisabled}>${btnText}</button>`; return template;
}

function mostrarMensagemNoContainer(container, msg){ 
    if (!container) return; 
    vazioElemento(container); 
    const div = document.createElement('div'); 
    div.className = 'loading-message'; 
    div.textContent = msg; 
    container.appendChild(div); 
}

function clearTimers(containerId) { if (activeTimers[containerId]) { activeTimers[containerId].forEach(intervalId => clearInterval(intervalId)); } activeTimers[containerId] = []; }

function iniciarContadores(produtos, containerEl) {
    if (!containerEl) return;
    
    const containerId = containerEl.id; 
    clearTimers(containerId); 
    
    produtos.forEach(p => {
        if (!p.dataOferta || !p.oferta) return;
        
        const timerEl = containerEl.querySelector(`[data-timer-id="${p.id}"]`);
        
        if (!timerEl) return;
        
        const [dia, mes, anoStr] = p.dataOferta.split('/');
        if (!dia || !mes || !anoStr) { console.warn(`Data de oferta inválida para ${p.nome}: ${p.dataOferta}`); return; }
        const hora = p.horaOferta ? parseInt(p.horaOferta, 10) : 23;
        const minutos = p.horaOferta ? 0 : 59;
        const segundos = p.horaOferta ? 0 : 59;
        let anoNum = parseInt(anoStr, 10);
        if (anoStr.length === 2) anoNum += 2000;
        const targetDate = new Date(anoNum, mes - 1, dia, hora, minutos, segundos);
        
        const updateCardDisplay = (produtoAtualizado) => {
            const cardElements = document.querySelectorAll(`.card .btn-add-cart[data-id="${produtoAtualizado.id}"]`);
            cardElements.forEach(btn => {
                const cardElement = btn.closest('.card');
                if (cardElement) {
                    const precoAtualEl = cardElement.querySelector('.preco-atual');
                    const precoOriginalEl = cardElement.querySelector('.preco-original');
                    const timerDisplayEl = cardElement.querySelector('.card-timer'); 
                    const badgeDisplayEl = cardElement.querySelector('.card-badge'); 
                    if (precoAtualEl) precoAtualEl.textContent = formatPrice(produtoAtualizado.preco);
                    if (precoOriginalEl) precoOriginalEl.style.display = 'none'; 
                    if (timerDisplayEl) timerDisplayEl.style.display = 'none';   
                    if (badgeDisplayEl) badgeDisplayEl.style.display = 'none';   
                }
            });
        };
        const intervalCallback = () => {
            const agora = Date.now();
            const diff = targetDate.getTime() - agora;
            if (diff <= 0) {
                clearInterval(intervalId); 
                const product = allProducts.get(p.id);
                if (product && product.precoOriginal && product.preco !== product.precoOriginal) {
                    console.log(`Oferta expirada para ${product.nome}. Revertendo preço.`);
                    product.preco = product.precoOriginal;
                    product.oferta = false; 
                    updateCardDisplay(product);
                } else if (timerEl) {
                    timerEl.style.display = 'none';
                    const cardElement = timerEl.closest('.card');
                     if (cardElement) {
                         const badgeDisplayEl = cardElement.querySelector('.card-badge');
                         if (badgeDisplayEl) badgeDisplayEl.style.display = 'none';
                     }
                }
                return; 
            }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            if (timerEl) timerEl.innerHTML = `${d}d ${h}h ${m}m ${s}s`; 
        };
        
        const intervalId = setInterval(intervalCallback, 1000);
        
        if (!activeTimers[containerId]) activeTimers[containerId] = [];
        activeTimers[containerId].push(intervalId);
        
        intervalCallback();
    });
}

function criarCardsEAdicionar(container, produtos){
    if (!container) return; 
    vazioElemento(container); 
    
    if(!produtos || produtos.length === 0){ 
        mostrarMensagemNoContainer(container, 'Nenhum produto encontrado.'); 
        return; 
    }
    
    produtos.forEach(p => { const card = criarCardHTML(p); container.appendChild(card); });
    
    iniciarContadores(produtos, container); 
}

function filtrarLista(produtos, { categoria = '', genero = '', tipos = [], precoMin = 0, precoMax = Infinity, searchTerm = '' } = {}){
    const termoBuscaLower = removerAcentos(searchTerm.toLowerCase());
    return produtos.filter(p => {
        if(categoria && p.categoria !== categoria) return false;
        if(genero && String(p.genero || '').toLowerCase() !== String(genero || '').toLowerCase()) return false;
        if(tipos.length > 0 && !tipos.includes(String(p.tipo || '').toLowerCase())) return false;
        const preco = Number(p.preco || 0);
        if(!isNaN(precoMin) && preco < precoMin) return false;
        if(!isNaN(precoMax) && preco > precoMax) return false;
        if(termoBuscaLower) { const nomeProdutoLower = removerAcentos(p.nome.toLowerCase()); if (!nomeProdutoLower.includes(termoBuscaLower)) { return false; } }
        return true;
    });
}

function adicionarClickHandlerMiniaturas(e) { if (e.target.classList.contains('card-thumb')) { e.preventDefault(); const card = e.target.closest('.card'); if (card) { const mainImg = card.querySelector('.card-img-main-pic'); if (mainImg) mainImg.src = e.target.src; } } }

function handleAddToCartClick(e) {
    if (!e.target.classList.contains('btn-add-cart')) return;
    const btnClicked = e.target; const productId = btnClicked.dataset.id; const product = allProducts.get(productId);
    if (!product) return;
    let cart = getCart(); 
    const existingItemIndex = cart.findIndex(item => item.id === product.id && !item.observacao); 
    if (existingItemIndex > -1) { 
        cart[existingItemIndex].quantity++; 
    } else { 
        cart.push({ id: product.id, nome: product.nome, preco: product.preco, quantity: 1, observacao: "" }); 
    }
    saveCart(cart); 
    updateCartButtonText();
    const cardBtns = document.querySelectorAll(`.btn-add-cart[data-id="${productId}"]`);
    cardBtns.forEach(button => { 
        if (button) { 
            if (!button.id || button.id !== 'detalheAddCart') {
                button.textContent = '✅ Já no carrinho'; 
                button.disabled = true; 
            }
        } 
    });
}

function handleCardClick(e) {
    const interactiveClasses = ['btn-add-cart', 'card-thumb'];
    if (interactiveClasses.some(cls => e.target.classList.contains(cls)) || 
        e.target.closest('a')) {
        return; 
    }
    const card = e.target.closest('.card');
    if (card) {
        const link = card.querySelector('.card-img-main a');
        if (link) {
            window.location.href = link.href; 
        }
    }
}

// ===================================
// FUNÇÃO PRINCIPAL DE FILTRAGEM E EXIBIÇÃO
// ===================================
function filtrarEExibirProdutos() {
    console.log("Filtrando...");
    const categoriaSelecionada = filtroCategoria.value;
    const generoSelecionado = filtroGenero.value;
    const precoMinValor = precoMin.value ? Number(precoMin.value) : 0;
    const precoMaxValor = precoMax.value ? Number(precoMax.value) : Infinity;
    const termoPesquisa = filtroPesquisa.value.trim();
    const tiposSelecionados = [];
    const checkboxesTipo = filtroTipoContainer.querySelectorAll('input[type="checkbox"]:checked');
    checkboxesTipo.forEach(cb => tiposSelecionados.push(cb.value));
    const filtros = { categoria: categoriaSelecionada, genero: generoSelecionado, tipos: tiposSelecionados, precoMin: precoMinValor, precoMax: precoMaxValor, searchTerm: termoPesquisa };
    const produtosAtivos = Array.from(allProducts.values());
    const produtosFiltrados = filtrarLista(produtosAtivos, filtros);
    let algumaOfertaVisivel = false;
    const ofertasFiltradas = produtosFiltrados.filter(p => p.oferta); 
    if (ofertasFiltradas.length > 0) {
        algumaOfertaVisivel = true;
        if(secaoOfertasEl) secaoOfertasEl.style.display = 'block';
        if (currentSortOrder === 'priceAsc') ofertasFiltradas.sort((a, b) => a.preco - b.preco);
        else if (currentSortOrder === 'priceDesc') ofertasFiltradas.sort((a, b) => b.preco - a.preco);
        criarCardsEAdicionar(listaOfertasEl, ofertasFiltradas);
    } else {
        if(secaoOfertasEl) secaoOfertasEl.style.display = 'none';
    }
    for (const [categoria, catData] of dynamicCategories.entries()) {
        const produtosDaCategoriaFiltrados = produtosFiltrados.filter(p => p.categoria === categoria);
        const mostrarSecao = (!filtros.categoria || categoria === filtros.categoria);
        if (mostrarSecao && produtosDaCategoriaFiltrados.length > 0) {
            if(catData.sectionEl) catData.sectionEl.style.display = 'block';
            if(catData.containerEl) {
                 if (currentSortOrder === 'priceAsc') produtosDaCategoriaFiltrados.sort((a, b) => a.preco - b.preco);
                 else if (currentSortOrder === 'priceDesc') produtosDaCategoriaFiltrados.sort((a, b) => b.preco - a.preco);
                 criarCardsEAdicionar(catData.containerEl, produtosDaCategoriaFiltrados);
            }
        } else {
            if(catData.sectionEl) catData.sectionEl.style.display = 'none';
        }
    }
    document.getElementById('sortAsc').classList.toggle('active', currentSortOrder === 'priceAsc');
    document.getElementById('sortDesc').classList.toggle('active', currentSortOrder === 'priceDesc');
}

// ===================================
// FUNÇÃO PRINCIPAL (INICIALIZAÇÃO)
// ===================================
async function loadAndRender(){
    showSkeletonLoaders(listaOfertasEl, 5);
    
    vazioElemento(navElement);
    Array.from(mainElement.querySelectorAll('.secao-categoria')).forEach(el => el.remove());
    let produtos = []; 
    try{
        const resp = await fetchSheetJson(SHEET_ID, GID);
        produtos = parseGvizResponse(resp); 
        console.log('Dados carregados (gviz):', allProducts.size, 'produtos ativos');
    }catch(err){
        console.warn('Falha ao carregar via gviz, tentando fallback opensheet:', err);
        try{
            const opensheetUrl = `https://opensheet.elk.sh/${SHEET_ID}/Página1`; const r = await fetch(opensheetUrl); if (!r.ok) throw new Error(`OpenSheet falhou com status ${r.status}`); const arr = await r.json();
            const todosProdutosFallback = arr.map(obj => { const headers = Object.keys(obj); const row = headers.map(h => ({ v: obj[h] })); return mapRowToProduct(row, headers); });
            produtos = todosProdutosFallback.filter(p => p.ativo);
            allProducts.clear(); dynamicCategories.clear();
            produtos.forEach(p => { allProducts.set(p.id, p); if (!dynamicCategories.has(p.categoria)) { dynamicCategories.set(p.categoria, { tipos: new Set(), generos: new Set(), containerId: `lista-${p.categoria}`, sectionId: `secao-${p.categoria}`, sectionEl: null, containerEl: null }); } const catData = dynamicCategories.get(p.categoria); 
                if (p.tipo) catData.tipos.add(p.tipo); 
                if (p.genero) catData.generos.add(p.genero); });
            console.log('Dados carregados (opensheet):', allProducts.size, 'produtos ativos');
        }catch(err2){
            console.error('Erro ao carregar planilha pelo fallback:', err2);
            mostrarMensagemNoContainer(listaOfertasEl, 'Erro ao carregar produtos. Verifique o console.');
            criarSecoesCategorias(); 
            for(const catData of dynamicCategories.values()){ 
                if(catData.containerEl) mostrarMensagemNoContainer(catData.containerEl, 'Erro ao carregar produtos.'); 
            }
            return;
        }
    }

    // RENDERIZAÇÃO PÓS-CARREGAMENTO
    criarSecoesCategorias(); 
    for (const [cat, data] of dynamicCategories.entries()) {
        data.sectionEl = document.getElementById(data.sectionId);
        data.containerEl = document.getElementById(data.containerId);
    }
    popularDropdown(filtroCategoria, dynamicCategories.keys(), "Todas as Categorias");
    filtrarEExibirProdutos(); 

    // LISTENERS
    filtroPesquisa.addEventListener('input', filtrarEExibirProdutos);
    filtroCategoria.addEventListener('change', (e) => {
        const categoria = e.target.value; filtroGenero.value = ""; filtroGenero.style.display = 'none'; vazioElemento(filtroTipoContainer); filtroTipoContainer.style.display = 'none';
        if (categoria) { const catData = dynamicCategories.get(categoria); if (catData) { if (catData.generos.size > 0) { popularDropdown(filtroGenero, catData.generos, "Todos os Gêneros"); filtroGenero.style.display = 'block'; } if (catData.tipos.size > 0) { criarCheckboxesTipo(filtroTipoContainer, catData.tipos); filtroTipoContainer.style.display = 'flex'; } } }
        filtrarEExibirProdutos();
    });
    filtroGenero.addEventListener('change', filtrarEExibirProdutos);
    precoMin.addEventListener('input', filtrarEExibirProdutos);
    precoMax.addEventListener('input', filtrarEExibirProdutos);
    btnSortAsc.addEventListener('click', () => { currentSortOrder = 'priceAsc'; filtrarEExibirProdutos(); });
    btnSortDesc.addEventListener('click', () => { currentSortOrder = 'priceDesc'; filtrarEExibirProdutos(); });
    btnLimparFiltros.addEventListener('click', () => {
        filtroPesquisa.value = ""; filtroCategoria.value = ""; filtroGenero.value = ""; vazioElemento(filtroTipoContainer); precoMin.value = ""; precoMax.value = ""; filtroGenero.style.display = 'none'; filtroTipoContainer.style.display = 'none'; currentSortOrder = 'default';
        filtrarEExibirProdutos();
    });
    
    mainElement.addEventListener('click', (e) => { 
        adicionarClickHandlerMiniaturas(e); 
        handleAddToCartClick(e);
        handleCardClick(e); 
    });

    // ==============================================
    // LISTENER DO FILTRO SANFONA
    // ==============================================
    if (toggleFiltersButton) {
        toggleFiltersButton.addEventListener('click', () => {
            const controlsSection = toggleFiltersButton.parentElement;
            controlsSection.classList.toggle('filters-visible');
            
            const isVisible = controlsSection.classList.contains('filters-visible');
            const textEl = toggleFiltersButton.querySelector('.filter-btn-text');
            const arrowEl = toggleFiltersButton.querySelector('.filter-btn-arrow');

            if (isVisible) {
                if(textEl) textEl.textContent = "Esconder Filtros";
                if(arrowEl) arrowEl.textContent = "▲";
            } else {
                if(textEl) textEl.textContent = "Filtros";
                if(arrowEl) arrowEl.textContent = "▼";
            }
        });
    }
}

// Inicializa tudo
document.addEventListener('DOMContentLoaded', () => {
    mainElement = document.querySelector('main');
    navElement = document.getElementById('menuNavegacao');
    listaOfertasEl = document.getElementById('listaOfertas');
    secaoOfertasEl = document.getElementById('secao-ofertas');
    filtroPesquisa = document.getElementById('filtroPesquisa');
    filtroCategoria = document.getElementById('filtroCategoria');
    filtroGenero = document.getElementById('filtroGenero');
    filtroTipoContainer = document.getElementById('filtroTipoContainer');
    precoMin = document.getElementById('precoMin');
    precoMax = document.getElementById('precoMax');
    btnLimparFiltros = document.getElementById('limparFiltros');
    btnSortAsc = document.getElementById('sortAsc');
    btnSortDesc = document.getElementById('sortDesc');
    
    toggleFiltersButton = document.getElementById('toggleFiltersButton');
    filtersSectionContainer = document.getElementById('filtersSectionContainer');
    
    // 1. Inicializa a lógica da página principal
    loadAndRender().catch(e => {
        console.error('Erro na inicialização:', e);
        mostrarMensagemNoContainer(listaOfertasEl, 'Erro grave na inicialização. Verifique o console.');
         Array.from(mainElement.querySelectorAll('.secao-categoria .container')).forEach(container => {
             mostrarMensagemNoContainer(container, 'Erro ao carregar produtos.');
         });
    });
    
    // 2. Inicializa a lógica do checkout (do checkout.js)
    initCheckout();
});