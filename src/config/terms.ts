export const CONTACT_EMAIL = 'riversmagalhaes@ifto.edu.br';
export const termsSections: { title: string; items: string[] }[] = [
    { title: 'O projeto', items: [
        'Este aplicativo é do projeto de ensino/extensão do IFTO Campus Paraíso do Tocantins, para melhorar o transporte escolar.',
        `Contato do projeto: ${CONTACT_EMAIL}.`,
    ] },
    { title: 'Seus dados', items: [
        'O app guarda seu nome e e-mail apenas para identificar quem registrou viagens e relatos.',
        'A localização só é gravada durante uma viagem que você inicia. Fora da viagem, nada é coletado.',
        'Relatos e fotos ficam na nuvem (Supabase). As fotos são apagadas após 90 dias.',
    ] },
    { title: 'Cuidados', items: [
        'Não fotografe rostos de pessoas nem envie dados pessoais de terceiros.',
        'Menores de 18 anos devem usar o app com ciência do responsável.',
        'Os relatos podem ser moderados pela equipe do projeto.',
    ] },
];
