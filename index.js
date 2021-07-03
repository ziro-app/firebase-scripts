// Referência da API Admin -> https://firebase.google.com/docs/reference/admin/node/admin.auth.Auth
require('dotenv').config()
const admin = require('firebase-admin')
const serviceAccount = require('./account_key.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const removeDuplicates = require('@ziro/remove-duplicates')
const { formatDateUTC, formatDateUTC3 } = require('@ziro/format-date-utc3')
const currencyFormat = require('@ziro/currency-format')
const axios = require('axios')

const formatHour = time => {
	const [dateHour, period] = time.split(' ');
	const [hour, minute, second] = dateHour.split(':');
	if (period === 'PM') return (parseInt(hour) === 12) ? `${hour}:${minute}:${second}` : `${parseInt(hour) + 12}:${minute}:${second}`;
	else return (parseInt(hour) === 12) ? `00:${minute}:${second}` : `${parseInt(hour) <= 9 ? `0${hour}` : hour}:${minute}:${second}`;
};

const formatDate = utcDate => {
	const [date, hour] = formatDateUTC3(utcDate).split(', ');
	const _hour = formatHour(hour);
	const [mounth, day, year] = date.replace(',', '').split('/');
	return `${parseInt(day) <= 9 ? `0${day}` : day}/${parseInt(mounth) <= 9 ? `0${mounth}` : mounth}/${year} ${_hour}`;
};

async function deleteCollectionPath(collectionPath, batchSize) {
	const collectionRef = db.collection(collectionPath);
	const query = collectionRef.limit(batchSize);

	return new Promise((resolve, reject) => {
		deleteQueryBatch(query, resolve).catch(reject);
	});
}

async function deleteQueryBatch(query, resolve) {
	if (query && query.get()) {
		const snapshot = await query.get();

		const batchSize = snapshot.size;
		if (batchSize === 0) {
			// When there are no documents left, we are done
			resolve();
			return;
		}

		// Delete documents in a batch
		const batch = db.batch();
		snapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});
		await batch.commit();

		// Recurse on the next process tick, to avoid
		// exploding the stack.
		process.nextTick(() => {
			deleteQueryBatch(query, resolve);
		});
	}
}

/** Varre todos os documentos em até 2 níveis de subcoleção */
const deleteAll = async (docRef) => {
	const hasCollections = await docRef.listCollections();
	if (!(hasCollections && hasCollections.length)) return new Promise(async (resolve, reject) => {
		await deleteQueryBatch(docRef, resolve).catch(reject);
	});
	else {
		return await Promise.all(hasCollections.map(async ref => {
			const data = await ref.get();
			data.docs.map(async it => {
				const hasInternalCollection = await it.ref.listCollections();
				hasInternalCollection.map(async internal => await deleteCollectionPath(internal.path, 20));
			});
			await deleteCollectionPath(ref.path, 20);
		}));
	}
};

/** Encontra documentos 'corrompidos' em uma coleção, apaga seus campos e subcoleções  */
const deleteSubcollectionsInEmptyDoc = async (collectionName = 'retailers') => {
	let collectionRef = db.collection(collectionName);
	const listDocuments = await collectionRef.listDocuments();
	const docsErased = [];
	await Promise.all(listDocuments.map(async it => {
		const all = await db.getAll(it);
		all.forEach(async doc => {
			if (!doc.exists) docsErased.push(doc.ref);
		});
	}));
	await Promise.all(docsErased.map(async it => await deleteAll(it)));
};

// Situação -> Transação passou na Zoop e não atualizou nas 2 bases (Com seguro)
const updateFirebase = async () => await db.collection('credit-card-payments').doc('##docID##').update({
	status: "Status_Transacao",
	installments: "Nº parcelas",
	datePaid: new Date("Data/Hora_Pagamento"), // Formato -> AAAA-MM(1-12)-DD HH:MM:SS
	dateLastUpdate: new Date("Data/Hora_Pagamento"), // Formato -> AAAA-MM(1-12)-DD HH:MM:SS
	cardBrand: "Bandeira_Cartao", // capitalizado -> Visa,MasterCard, etc
	cardholder: "Portador_cartao", // em lowerCase()
	cardFirstFour: "****",
	cardLastFour: "****",
	transactionZoopId: "Id_Transacao",
	receiptId: "Id_receipt", // -> campo sales_receipt, encontrado nos detalhes da transação (Zoop)
	splitTransaction: {
		// split_rules da transacao -> Fazer o match com o firebase
		antiFraud: { amount: 0, percentage: 0.95 },
		markup: { amount: 0, percentage: 0 },
	},
	authorizer: "rede",
	onBehalfOfBrand: "",
	buyerStoreownerId: "Doc_Id_Comprador",
	buyerRazao: "Razao_Pagador"
});

const updateSheet = async () => {
	const url = process.env.SHEET_URL;
	const config = {
		headers: {
			'Content-type': 'application/json',
			'Authorization': process.env.SHEET_TOKEN,
			'Origin': 'https://ziro.app'
		}
	};
	const body = {
		apiResource: 'values',
		apiMethod: 'append',
		spreadsheetId: process.env.SHEET_TRANSACTIONS_ID,
		range: 'Transacoes!A1',
		resource: {
			values: [
				[
					"Id_Transacao",
					formatDate(new Date("2021-01-11T13:09:40+00:00")),
					"Status_Transacao",
					"crédito",
					"Nº parcelas",
					"Hut Confeccoes - Eireli",
					"Razao_Pagador",
					"Portador_cartao", // em lowerCase()
					"Bandeira_Cartao", // capitalizado -> Visa,MasterCard, etc
					`****...****`,
					"2.591,39"
				]
			]
		},
		valueInputOption: 'user_entered'
	};
	await axios.post(url, body, config);
};

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
	const cardPayments = await db.collection('credit-card-payments').where('status', '==', 'Aprovado').get()
	let receivables = []
	cardPayments.forEach(doc => receivables.push({
		id: doc.data().transactionZoopId,
		receivables: doc.data().receivables
	}))
	const formatted = receivables.map(({ id, receivables: arrReceivable }) =>
		arrReceivable.map(({ installment, gross_amount, amount, expected_on, paid_at, status }) => {
			const grossAmount = gross_amount.replace('.', ',')
			const finalAmount = amount.replace('.', ',')
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
	const cardPayments = await db.collection('credit-card-payments').where('seller', '==', 'Lojas Marisa').get()
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
	console.log('total requests:', numberOfRequests)
	console.log('total items:', total)
	if (data.has_more) {
		for (let i = 0; i < Math.ceil(data.total / 100) - 1; i++) {
			const { items: items_more } = await fetch(dateMin, dateMax, 100 + i * 100)
			items.push(...items_more)
			console.log('items mapped:', items.length)
		}
		const events = items.map(({ type }) => type).sort((a, b) => a < b ? -1 : 1)
		console.log(removeDuplicates(events))
	} else {
		console.log('items mapped:', items.length)
		const events = items.map(({ type }) => type).sort((a, b) => a < b ? -1 : 1)
		console.log(removeDuplicates(events))
	}
}

// fetchZoopEvents();

// Funções para corrigir erros de escrita no firebase e planilhas
// updateFirebase();
// updateSheet();
// -> Após rodar essas funções, lembrar de rodar o webhook transaction
deleteSubcollectionsInEmptyDoc();