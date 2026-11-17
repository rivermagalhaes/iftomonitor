export const categories = ['atraso','quebra','superlotacao','parada_nao_feita','desvio','limpeza_conservacao','seguranca','outro'] as const;
export interface PhotoInput { mime_type: string; size_bytes: number }
export interface ReportInput { bus_label: string; route_name?: string; category: string; message: string; photos: PhotoInput[]; honeypot?: string }
export function validateReport(input: unknown): ReportInput {
 if (!input || typeof input !== 'object') throw new Error('Relato inválido');
 const v=input as Record<string,unknown>;
 const clean=(value: unknown,max:number,required=false)=>{if(value!==undefined && typeof value!=='string') throw new Error('Texto inválido'); const s=String(value??'').replace(/\s+/g,' ').trim();if(s.length>max || /<[^>]*>|[<>]/.test(s) || (required&&!s)) throw new Error('Texto inválido'); return s;};
 if(v.honeypot!==undefined && v.honeypot!=='') throw new Error('Envio inválido');
 const bus_label=clean(v.bus_label,60,true),route_name=clean(v.route_name,80),message=clean(v.message,500);
 if(!categories.includes(v.category as typeof categories[number])) throw new Error('Categoria inválida');
 if(v.photos!==undefined && !Array.isArray(v.photos)) throw new Error('Fotos inválidas');
 const photos=(v.photos??[]) as PhotoInput[];
 if(photos.length>2 || photos.some(p=>!p || !['image/jpeg','image/png','image/webp'].includes(p.mime_type)||!Number.isInteger(p.size_bytes)||p.size_bytes<1||p.size_bytes>1048576)) throw new Error('Fotos inválidas');
 if(!message&&!photos.length) throw new Error('Escreva ou envie uma foto');
 return {bus_label,route_name,category:String(v.category),message,photos};
}
