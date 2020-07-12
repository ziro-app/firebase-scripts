// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth
require('dotenv').config()
const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const removeDuplicates = require('@ziro/remove-duplicates')
const { formatDateUTC } = require('@ziro/format-date-utc3')
const currencyFormat = require('@ziro/currency-format')
const axios = require('axios')

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

const fetch = async (dateMin, dateMax, offset) => {
	const { data } = await axios({
		url: process.env.ZOOP_EVENT_URL,
		method: 'GET',
		headers: {
			'Authorization': process.env.ZOOP_TOKEN,
			'Content-Type': 'application/json'
		},
		params: {
			'date_range[gte]': dateMin,
			'date_range[lte]': dateMax,
			offset: offset ? offset : 0
		}
	})
	return data
}

const fetchZoopEvents = async () => {
	const dateMin = '2020-07-01T01:00:00'
	const dateMax = '2020-07-02T01:00:00'
	const data = await fetch(dateMin, dateMax)
	const { items, total } = data
	const numberOfRequests = Math.ceil(total / 100)
	console.log('total requests:',numberOfRequests)
	console.log('total items:',total)
	if (data.has_more) {
		for (let i = 0; i < Math.ceil(data.total / 100) - 1; i++) {
			const { items: items_more } = await fetch(dateMin, dateMax, 100 + i * 100)
			items.push(...items_more)
			console.log('items mapped:',items.length)
		}
		const events = items.map(({ type }) => type).sort((a,b) => a < b ? -1 : 1)
		console.log(removeDuplicates(events))
	} else {
		console.log('items mapped:',items.length)
		const events = items.map(({ type }) => type).sort((a,b) => a < b ? -1 : 1)
		console.log(removeDuplicates(events))
	}
}

fetchZoopEvents()