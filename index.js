// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth

const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const removeDuplicates = require('@ziro/remove-duplicates')
const { formatDateUTC } = require('@ziro/format-date-utc3')
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

const getAllReceivables = async () => {
	const cardPayments = await db.collection('credit-card-payments').where('status','==','Aprovado').get()
	let receivables = []
	cardPayments.forEach(doc => receivables.push({
		id: doc.data().transactionZoopId,
		receivables: doc.data().receivables
	}))
	const formatted = receivables.map(({ id, receivables: arrReceivable }) =>
			arrReceivable.map(({ installment, gross_amount, amount, expected_on, paid_at, status }) => {
			const grossAmount = gross_amount.replace('.',',')
			const finalAmount = amount.replace('.',',')
			const dateExpected = expected_on ? formatDateUTC(new Date(expected_on._seconds * 1000)) : ''
			const [expected] = typeof dateExpected === 'string' ? dateExpected.split(' ') : ''
			const datePaid = paid_at ? formatDateUTC(new Date(paid_at._seconds * 1000)) : ''
			const [paid] = typeof datePaid === 'string' ? datePaid.split(' ') : ''
			const translatedStatus = status.toLowerCase() === 'pending' ? 'Pendente' : 'Pago'
			return [id, installment, grossAmount, finalAmount, expected, paid, translatedStatus]
	}))
	console.log(formatted.flat())
}

const getAllPaymentsToDelete = async () => {
	const cardPayments = await db.collection('credit-card-payments').where('seller','==','Lojas Marisa').get()
	console.log(cardPayments)
	let payments = []
	cardPayments.forEach(doc => payments.push(doc.ref.delete()))
	const result = await Promise.all(payments)
	console.log(result)
}

getAllReceivables()