# Congestionamento Cerebral

Quebra-cabeça de lógica com tabuleiro de 6 × 6. Deslize os veículos no próprio eixo e leve o carrinho vermelho pela abertura à direita.

[Jogar Congestionamento Cerebral](https://parametrica.com.br/congestionamentocerebral/)

O catálogo inicial tem 80 desafios originais em quatro dificuldades. O jogo funciona com mouse, toque e teclado em celular, tablet e desktop. Ao vencer, você vê quantos movimentos usou e qual era o mínimo da fase.

A progressão padrão é sequencial e pode ser alterada em **Configurações**. Concluir as fases normais de uma dificuldade libera o sorteio dos seus extras. O painel lê os totais do catálogo, e cada extra tem um mínimo dentro da faixa das fases normais da sua dificuldade.

No teclado, use **Tab** para selecionar um veículo e as **setas** para movê-lo. Segure **Shift** para deslizar até o limite numa única jogada.

## Rodar e testar

O jogo usa HTML, CSS e JavaScript. Com Node.js instalado, execute `npm start` na pasta do projeto e abra [o jogo local](http://127.0.0.1:5173/). Use `npm test` para verificar as regras, a progressão e as soluções do catálogo.

## Publicar

Execute `npm run build` e copie o conteúdo de `publicacao/` para a pasta pública da hospedagem estática. O pacote inclui uma cópia exata do catálogo no módulo do jogo, compatível com servidores que restringem requisições feitas pela página. Ao editar `src/levels.json`, gere e publique o pacote novamente.

## Editar o catálogo

O jogo lê [src/levels.json](src/levels.json). Para acrescentar uma fase, adicione uma entrada em `difficulties.<dificuldade>.normal` ou `difficulties.<dificuldade>.extra`. Use um `id` único no catálogo e inclua as peças em `objects`. A ordem do JSON é a ordem da campanha, com exceção do Intermediário, que o jogo ordena pelo mínimo.

- Cada peça tem `id`, `axis` (`h` ou `v`), `row`, `column`, `length` (2 ou 3), `color` e `facing` (`1` para direita/baixo ou `-1` para esquerda/cima). As coordenadas vão de 1 a 6 e apontam para a casa mais à esquerda ou mais acima da peça. A primeira peça, `X`, é o carro vermelho horizontal da linha 3, com duas casas e `facing: 1`.
- `solution` contém um objeto por movimento. Por exemplo, `{"object": "V2", "row": 1, "column": 4}` indica a casa de destino, e `{"object": "X", "exit": true}` encerra a solução. O tamanho dessa lista é o mínimo mostrado na vitória.
- Para calcular e gravar a solução mínima de uma fase, execute `npm run solve -- meu-desafio` com o ID da entrada. Você pode informar vários IDs na mesma chamada. Use `npm test` para verificar a legalidade e a contagem mínima de todas as soluções.
- Para acrescentar dois extras originais automaticamente, execute `npm run generate -- especialista extra 2`. Use `normal` no lugar de `extra` para gerar fases normais.

O navegador guarda o progresso com uma cópia exata do catálogo carregado. Ao abrir ou recarregar o jogo após mudar o catálogo, até mesmo a formatação, vitórias e partidas salvas são reiniciadas. A preferência de progressão é mantida. Na versão hospedada, a mudança entra em vigor ao publicar o novo pacote. A primeira abertura com o novo catálogo também reinicia os salvamentos antigos que ainda não têm essa cópia.
