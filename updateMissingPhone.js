// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth
require('dotenv').config()
const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

let documentsArray = [];
let withTelefoneArray = [];
let withoutTelefoneArray = [];

const getSuppliers = async () => {
  try {
    const result = await db.collection('suppliers').get();

    result.forEach(doc => {
      documentsArray.push(doc.data());
    });

    documentsArray.map(supplier => {
      supplier.telefone || supplier.telefone === '' ? withTelefoneArray.push(supplier)
      :
      withoutTelefoneArray.push(supplier)
    });
  
    console.log('Terminou getSuppliers.');
    
    return withoutTelefoneArray;
  } catch (error) {
    console.error('Erro no getSuppliers:', error);
  };
};

const updateMissingPhone = (suppliersArray) => {
  const mockArraySuppliers = suppliersArray;
  
  const arrayFunction = mockArraySuppliers.map(supplier => {
    console.log('Usuário', supplier.email, 'atualizado.');
    return db.collection('suppliers').doc(supplier.uid).update({ telefone: '' });
  })

  return arrayFunction;
};

const run = async () => {
  try {
    const suppliers = await getSuppliers();
    const result = await Promise.all(updateMissingPhone(suppliers));

    console.log('result:', result);
  } catch (error) {
    console.error('Erro no run:', error);
  };
};

run();