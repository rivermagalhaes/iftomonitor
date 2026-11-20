export const CONTACT_EMAIL = 'riversmagalhaes@ifto.edu.br';
export const termsSections: { title: string; items: string[] }[] = [
    { title: 'Para todos', items: [
        'Este aplicativo é do projeto de ensino/extensão do IFTO Campus Paraíso do Tocantins, para melhorar o transporte escolar.',
        `Contato do projeto: ${CONTACT_EMAIL}.`,
        'Os dados ficam armazenados na nuvem (Supabase). As fotos são apagadas após 90 dias.',
    ] },
    { title: 'Se você é aluno (relatos)', items: [
        'Você informa o ônibus, o tipo de ocorrência, um texto e até 2 fotos.',
        'NÃO fotografe rostos de pessoas e NÃO envie dados pessoais (nome, telefone, documentos).',
        'Os relatos podem ser moderados pela equipe do projeto.',
    ] },
    { title: 'Se você é monitor (coleta no ônibus)', items: [
        'A localização do ônibus é registrada SOMENTE durante a viagem iniciada por você. Nenhuma coleta é feita fora da viagem.',
        'Para registrar a viagem, o aplicativo precisa funcionar com a tela apagada.',
    ] },
];
