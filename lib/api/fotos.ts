import { fotoUrl, type UsoFoto } from '../cloudinary';
import { uploadFotoCloudinary } from './stories';

/**
 * Sobe a foto (post, comentário, perfil, banner) no Cloudinary e devolve o endereço já no tamanho do uso. Desde out/2026
 * as fotos novas saem do Storage do Supabase (o tráfego delas estourou o plano grátis); as antigas continuam lá e o
 * app mostra as duas (endereço completo passa direto, caminho do Storage é assinado).
 */
export async function enviarFoto(blob: Blob, uso: UsoFoto): Promise<string> {
  return fotoUrl(await uploadFotoCloudinary(blob), uso);
}
