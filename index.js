// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth

const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const removeDuplicates = require('@ziro/remove-duplicates')
const dateHourFormatterUTC3 = require('@ziro/format-date-utc3')
const currencyFormat = require('@ziro/currency-format')

const getAllPayments = async () => {
	const cardPayments = await db.collection('credit-card-payments').get()
	cardPayments.forEach(doc => console.log(doc.data()))
	console.log(cardPayments.docs.length)
}

const getAllSuppliersWithPayments = async () => {
	const cardPayments = await db.collection('credit-card-payments').get()
	let sellers = []
	cardPayments.forEach(doc => sellers.push(doc.data().seller))
	console.log(removeDuplicates(sellers))
}

const getAllPaymentsToDelete = async () => {
	const cardPayments = await db.collection('credit-card-payments').where('seller','==','Lojas Marisa').get()
	console.log(cardPayments)
	let payments = []
	cardPayments.forEach(doc => payments.push(doc.ref.delete()))
	const result = await Promise.all(payments)
	console.log(result)
}

getAllPayments()