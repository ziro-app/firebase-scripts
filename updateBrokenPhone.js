// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth
require('dotenv').config()
const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

let documentsArray = [];
let normalPhoneArray = [];
let brokenPhoneArray = [];

const getSuppliers = async () => {
  try {
    const result = await db.collection('suppliers').get();

    result.forEach(doc => {
      documentsArray.push(doc.data());
    });

    documentsArray.map(supplier => {
      supplier.telefone.startsWith('(') ? brokenPhoneArray.push(supplier)
      :
      normalPhoneArray.push(supplier)
    });
  
    console.log('Terminou getSuppliers.');
    
    return brokenPhoneArray;
  } catch (error) {
    console.error('Erro no getSuppliers:', error);
  };
};

const updateBrokenPhone = (suppliersArray) => {
  const mockArraySuppliers = suppliersArray;
  
  const arrayFunction = mockArraySuppliers.map(supplier => {
    console.log('Usuário', supplier.email, 'com o campo telefone:', supplier.telefone, 'atualizado com sucesso!');

    return db.collection('suppliers').doc(supplier.uid).update({ telefone: `55 ${supplier.telefone}` });
  })

  return arrayFunction;
};

const run = async () => {
  try {
    const suppliers = await getSuppliers();
    const result = await Promise.all(updateBrokenPhone(suppliers));

    console.log('result:', result);
  } catch (error) {
    console.error('Erro no run:', error);
  };
};

run();