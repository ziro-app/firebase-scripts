// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth
require('dotenv').config()
const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

let documentsArray = [];
let whatsAppArray = [];
let withoutWhatsAppArray = [];

const getSuppliers = async () => {
  try {
    const result = await db.collection('suppliers').get();

    result.forEach(doc => {
      documentsArray.push(doc.data());
    });

    documentsArray.map(supplier => {
      supplier.whatsapp || supplier.whatsapp === '' ? whatsAppArray.push(supplier)
      :
      withoutWhatsAppArray.push(supplier)
    });
  
    console.log('Terminou getSuppliers.');
    
    return withoutWhatsAppArray;
  } catch (error) {
    console.error('Erro no getSuppliers:', error);
  };
};

const updateWhatsApp = (suppliersArray) => {
  const mockArraySuppliers = suppliersArray;
  
  const arrayFunction = mockArraySuppliers.map(supplier => {
    console.log('Usuário', supplier.email, 'atualizado.');
    return db.collection('suppliers').doc(supplier.uid).update({ whatsapp: '' });
  })

  return arrayFunction;
};

const run = async () => {
  try {
    const suppliers = await getSuppliers();
    const result = await Promise.all(updateWhatsApp(suppliers));

    console.log('result:', result);
  } catch (error) {
    console.error('Erro no run:', error);
  };
};

run();



// const updateWhatsApp = async () => {
//   try {
//     console.time();
//     const allSuppliers = await db.collection('suppliers').get();

//     allSuppliers.forEach(doc => {
//       documentsArray.push(doc.data());
//     });

//     documentsArray.map(supplier => {    
//       supplier.whatsapp ? whatsAppArray.push(supplier)
//       :
//       withoutWhatsAppArray.push(supplier)        
//     });
    
//     const promiseWhatsApp = withoutWhatsAppArray.map(eachSupplier => {
//       db.collection('suppliers').doc(eachSupplier.uid).update({ whatsapp: '' })
      
//       console.log('Usuário', eachSupplier.email, 'atualizado com sucesso.');
//     });

//     console.log('promiseWhatsApp:', promiseWhatsApp);

//     const result = await Promise.all(promiseWhatsApp);

//     console.log('result:', result);
    
//     console.timeEnd();
//   } catch (error) {
//     console.log('Deu ruim ao atualizar:', error);
//   };
// };

// updateWhatsApp();