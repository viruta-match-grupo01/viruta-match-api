import {describe,it,expect} from 'vitest';
import {createCaptureChannel,createUnavailableWhatsAppChannel} from '../src/channels.js';

describe('Simulación de notificaciones sin proveedor externo',()=>{
  it('captura el correo con destinatario, asunto y contenido sin enviarlo a Internet',async()=>{
    const channel=createCaptureChannel();
    const aviso={avisoId:99,email:'cliente@example.invalid',subject:'Viruta Match: retazo compatible',text:'Retazo disponible para tu pedido'};
    const result=await channel.send(aviso);
    expect(result.providerId).toBe('captura-99');
    expect(channel.messages).toHaveLength(1);
    expect(channel.messages[0]).toEqual(aviso);
    aviso.text='modificado';
    expect(channel.messages[0].text).toBe('Retazo disponible para tu pedido');
  });
  it('no inventa entrega por WhatsApp cuando no está configurado',async()=>{
    await expect(createUnavailableWhatsAppChannel().send({avisoId:100})).rejects.toMatchObject({code:'WHATSAPP_NO_CONFIGURADO',deliveryUncertain:false});
  });
});
