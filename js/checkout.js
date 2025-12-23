// js/checkout.js - VERSÃO CORRIGIDA (Header, Limpeza e Caracteres)

// --- CONFIGURAÇÃO ---
const WHATSAPP_NUMBER = "5548999560110"; // Seu número (apenas dígitos)
// --------------------

function getCart() {
    return JSON.parse(localStorage.getItem("leandrinhoCart") || "[]");
}

function saveCart(cart) {
    localStorage.setItem("leandrinhoCart", JSON.stringify(cart));
}

function escapeHtml(text) {
    if (!text && text !== 0) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function vazioElemento(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function updateCartButtonText() {
    const btn = document.getElementById('enviarWhatsApp');
    if (!btn) return;
    const cart = getCart();
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    // Atualiza o botão flutuante do rodapé
    if (totalQty > 0) {
        btn.textContent = `🛒 Ver Carrinho (${totalQty} ${totalQty > 1 ? 'itens' : 'item'})`;
        btn.classList.add('has-items');
    } else {
        btn.textContent = "🛒 Carrinho Vazio";
        btn.classList.remove('has-items');
    }
}

function abrirModalCarrinho() {
    const cart = getCart();
    const modal = document.getElementById('modalCarrinho');
    const listaModal = document.getElementById('listaCarrinhoModal');
    const totalEl = document.getElementById('totalCarrinhoModal');
    const btnEnviar = document.getElementById('btnEnviarWhatsApp');

    vazioElemento(listaModal);

    if (cart.length === 0) {
        listaModal.innerHTML = '<p style="text-align:center; padding: 20px;">Seu carrinho está vazio.</p>';
        if(totalEl) totalEl.textContent = "Total: R$ 0,00";
        if(btnEnviar) btnEnviar.style.display = "none";
    } else {
        let total = 0;
        cart.forEach(item => {
            const itemTotal = item.preco * item.quantity;
            total += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item-modal';
            
            let nomeDisplay = escapeHtml(item.nome);
            if (item.observacao) {
                nomeDisplay += `<br><small class="item-obs-modal">Obs: ${escapeHtml(item.observacao)}</small>`;
            }

            div.innerHTML = `
                <div class="cart-item-modal-info">
                    <span class="nome">${nomeDisplay}</span>
                    <span class="preco">${formatPrice(item.preco)} un.</span>
                </div>
                <div class="cart-item-modal-actions">
                    <div class="cart-item-modal-controls">
                        <button class="qty-btn decrease-qty" data-id="${item.id}">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn increase-qty" data-id="${item.id}">+</button>
                    </div>
                    <span style="font-size: 0.9rem; font-weight: bold;">${formatPrice(itemTotal)}</span>
                    <button class="remover-item-btn" data-id="${item.id}" style="font-size:0.7rem; padding: 2px 5px; margin-top:5px;">Remover</button>
                </div>
            `;
            listaModal.appendChild(div);
        });

        if(totalEl) totalEl.textContent = `Total Geral: ${formatPrice(total)}`;
        if(btnEnviar) btnEnviar.style.display = "block";
    }

    modal.style.display = 'flex';
}

function fecharModalCarrinho() {
    document.getElementById('modalCarrinho').style.display = 'none';
}

function handleRemoverItem(id) {
    let cart = getCart();
    cart = cart.filter(item => item.id.toString() !== id.toString());
    saveCart(cart);
    abrirModalCarrinho();
    updateCartButtonText();
    
    // Reabilita botões na interface
    const btn = document.querySelector(`.btn-add-cart[data-id="${id}"]`);
    if (btn) {
        btn.textContent = "Adicionar ao Carrinho";
        btn.disabled = false;
    }
}

function increaseQuantity(id) {
    let cart = getCart();
    const index = cart.findIndex(item => item.id.toString() === id.toString());
    if (index > -1) {
        cart[index].quantity++;
        saveCart(cart);
        abrirModalCarrinho();
        updateCartButtonText();
    }
}

function decreaseQuantity(id) {
    let cart = getCart();
    const index = cart.findIndex(item => item.id.toString() === id.toString());
    if (index > -1) {
        if (cart[index].quantity > 1) {
            cart[index].quantity--;
            saveCart(cart);
            abrirModalCarrinho();
            updateCartButtonText();
        } else {
            handleRemoverItem(id);
        }
    }
}

function enviarPedidoWhatsApp() {
    const cart = getCart();
    if (cart.length === 0) {
        alert("Seu carrinho está vazio.");
        return;
    }

    // Pega observação geral se existir
    const obsGeral = document.getElementById('observacaoGeral') ? document.getElementById('observacaoGeral').value : '';

    let mensagem = "*Olá! Gostaria de fazer o seguinte pedido no Catálogo:*\n\n";
    let totalGeral = 0;

    cart.forEach(item => {
        const subtotal = item.preco * item.quantity;
        totalGeral += subtotal;
        // CORREÇÃO: Usando hífen simples (-) em vez de caractere especial para evitar erros
        mensagem += `- ${item.quantity}x ${item.nome}\n`;
        if (item.observacao) mensagem += `   _(Obs: ${item.observacao})_\n`;
        mensagem += `   Valor: ${formatPrice(subtotal)}\n`;
    });

    mensagem += `\n*Total do Pedido: ${formatPrice(totalGeral)}*`;
    
    if (obsGeral && obsGeral.trim() !== "") {
        mensagem += `\n\n*Observações:* ${obsGeral}`;
    }

    mensagem += `\n\nAguardo confirmação!`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
    
    // Abre o WhatsApp
    window.open(url, '_blank');

    // CORREÇÃO: Limpa o carrinho e atualiza a interface após enviar
    setTimeout(() => {
        saveCart([]); // Esvazia o array
        updateCartButtonText(); // Atualiza botão do rodapé
        fecharModalCarrinho(); // Fecha o modal
        
        // Opcional: Reseta os botões da loja para "Adicionar ao Carrinho"
        const botoesDesabilitados = document.querySelectorAll('.btn-add-cart:disabled');
        botoesDesabilitados.forEach(btn => {
            btn.textContent = "Adicionar ao Carrinho";
            btn.disabled = false;
        });

        // Limpa campo de observação
        if(document.getElementById('observacaoGeral')) {
            document.getElementById('observacaoGeral').value = "";
        }
    }, 1000); // Espera 1 segundo para garantir que o usuário viu a ação
}

function initCheckout() {
    // CORREÇÃO: Configura o botão do Header (Canto superior direito)
    const whatsappHeaderBtn = document.getElementById('whatsappHeaderButton');
    if (whatsappHeaderBtn) {
        const msgHeader = encodeURIComponent("Olá! Vim do site Eleven Store e gostaria de tirar uma dúvida.");
        whatsappHeaderBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msgHeader}`;
        whatsappHeaderBtn.target = "_blank";
    }

    // Inicializa botão do rodapé
    const footerBtn = document.getElementById('enviarWhatsApp');
    if (footerBtn) {
        footerBtn.addEventListener('click', () => {
            if (getCart().length > 0) abrirModalCarrinho();
            else alert("Seu carrinho está vazio.");
        });
    }

    // Inicializa eventos do Modal
    const modal = document.getElementById('modalCarrinho');
    if (modal) {
        // Fechar modal
        document.getElementById('fecharModal').addEventListener('click', fecharModalCarrinho);
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) fecharModalCarrinho();
        });

        // Cliques dentro da lista (aumentar/diminuir/remover)
        document.getElementById('listaCarrinhoModal').addEventListener('click', (e) => {
            const target = e.target;
            const btn = target.closest('button'); // Pega o botão mesmo se clicar no ícone
            if (!btn) return;
            
            const id = btn.dataset.id;
            if (!id) return;

            if (btn.classList.contains('remover-item-btn')) handleRemoverItem(id);
            else if (btn.classList.contains('increase-qty')) increaseQuantity(id);
            else if (btn.classList.contains('decrease-qty')) decreaseQuantity(id);
        });

        // Botão Finalizar
        const btnEnviar = document.getElementById('btnEnviarWhatsApp');
        if (btnEnviar) {
            btnEnviar.addEventListener('click', enviarPedidoWhatsApp);
        }
    }
    
    // Atualiza texto inicial
    updateCartButtonText();
}