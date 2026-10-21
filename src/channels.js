import nodemailer from 'nodemailer';
/** NotificationChannel.send(message): resuelve solo si el proveedor aceptó el envío. */
export function createCaptureChannel() {
  const messages=[];
  return {messages,async send(message){messages.push(structuredClone(message));return {providerId:`captura-${message.avisoId}`};}};
}
export function createUnavailableWhatsAppChannel() {
  return {async send(){const e=new Error('WhatsApp pendiente de integración con el chatbot');e.code='WHATSAPP_NO_CONFIGURADO';e.deliveryUncertain=false;throw e;}};
}
export function createSmtpChannel(config) {
  for(const key of ['host','from']) if(!config[key]) throw new Error(`Falta SMTP ${key}`);
  const transport=nodemailer.createTransport({host:config.host,port:config.port??587,secure:config.secure??false,auth:config.user?{user:config.user,pass:config.password}:undefined,connectionTimeout:15000,socketTimeout:30000,greetingTimeout:15000,tls:{rejectUnauthorized:true}});
  return {async send(message){
    try {
      const result=await transport.sendMail({from:config.from,to:message.email,subject:message.subject,text:message.text,messageId:`<viruta-aviso-${message.avisoId}@${config.messageIdDomain??'viruta.local'}>`});
      if(!result.accepted?.length) {const e=new Error('Proveedor no aceptó al destinatario');e.deliveryUncertain=false;throw e;}
      return {providerId:result.messageId};
    } catch(e) {
      if(e.deliveryUncertain===undefined) e.deliveryUncertain=!(e.responseCode>=400||e.code==='EAUTH'||e.command==='CONN');
      throw e;
    }
  },close(){transport.close();}};
}
