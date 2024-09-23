import {MongoClient} from "mongodb";
import * as dotenv from 'dotenv';
import {redirect} from "@sveltejs/kit";
import {v4 as uuidv4} from "uuid";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URL);
const userDatabase = client.db("User");
const money = client.db("Money");
const passes = money.collection("mo_passes");
const user = userDatabase.collection("us_user_data");

let passMapping = {
    'MAHE Pass': 'Flagship',
    'Solo Dance': 'Solo Dance NM',
    'Group Dance': 'Group Dance NM',
    'eSports': 'Esports',
    'Fashion Show': 'Fashion Show NM',
    'Battle Of Bands': 'BOB NM',
    'Drama': 'Drama NM',
    'Photography': 'Photo-Op NM',
    'Short Film Making': 'Film Making NM',
    'Ad Design': 'Ad Design NM',
    'Football': 'Football',
    'Basketball(Boys)': 'Mens Basketball',
    'Basketball(girls)': 'Womens Basketball',
    'Cricket': 'Cricket',
    'Volleyball': 'Volleyball',
    'Athletics': 'Athletics',
    'Badminton(Boys)': 'Mens Badminton',
    'Badminton(girls)': 'Womens Badminton',
    'Badminton(mixed)': 'Mixed Badminton',
    'Table Tennis': 'Table Tennis',
    'Chess': 'Chess',
}

export const load = async (event) => {
    const session = await event.locals.auth();
    if (!session?.user) {
        redirect(302, '/?status=1&details=Sign%20In%20To%20Access');
    }

    const foundUser = await user.findOne({
        email: session.user.email,
    });
    if (!foundUser) {
        redirect(302, '/?status=1&details=User%20Not%20Registered');
    }
}


export const actions = {
    checkPaymentAndGeneratePass: async (event) => {
        const session = await event.locals.auth();
        let foundUser = await user.findOne({email: session.user.email});
        if (!foundUser) {
            redirect(302, '/tickets?status=1&details=User%20Not%20Registered');
        }
        console.log(foundUser.userPhoneNumber);
        let payments = await fetchPaymentLogs(1, foundUser.userPhoneNumber);
        payments = {
            "status": {
                "code": 0,
                "message": "Payment Logs."
            },
            "data": {
                "docs": [
                    {
                        "_id": "66ed68a00d9ad066b47b4c48",
                        "is_posted": 0,
                        "tracking_id": "pay_OzQ0qhluWkaIMn",
                        "order_status": "Success",
                        "currency": "INR",
                        "actual_amount": "116.82",
                        "billing_name": "Shreyas Chaudhary",
                        "billing_tel": "7376257882",
                        "membership_type": "Falak",
                        "created_at": "2024-09-20",
                        "orderid": "order_OzQ0PdGJYMETQP",
                        "receiptno": "FALAK7669",
                        "total_amount": "116.82",
                        "user_type": "NONMAHE",
                        "name": "Shreyas Chaudhary",
                        "registration_number": "7376257882",
                        "email": "shreyaschaudhary0702@gmail.com",
                        "esports": true,
                        "esports_amount": 116.82,
                        "amount": 0,
                        "gst": 17.82,
                        "base_price": 99
                    }
                ],
                "totalDocs": 1,
                "limit": 10,
                "page": 1,
                "totalPages": 1,
                "pagingCounter": 1,
                "hasPrevPage": false,
                "hasNextPage": false,
                "prevPage": null,
                "nextPage": null
            }
        }
        console.log(payments.data.docs);
        if (!payments) {
            redirect(302, '/payment/m-check?status=1&details=No%20Payments%20Found');
        }
        if (payments.data.totalDocs === 0) {
            redirect(302, '/payment/m-check?status=1&details=No%20Payments%20Found');
        } else {
            if (payments.data.totalPages === 1) {
                for (let i = 0; i < payments.data.docs.length; i++) {
                    console.log(payments.data.docs[i].event_name);
                    console.log(passMapping[payments.data.docs[i].event_name]);
                    let passName = passMapping[payments.data.docs[i].event_name];

                    if (passName !== undefined) {
                        let foundPass = await passes.findOne({
                            email: session.user.email,
                            pass_name: passName.toString(),
                            banned: false,
                        });

                        console.log('foundPass', foundPass)
                        if (!foundPass) {
                            let generatedTokenForPass;
                            while (true) {
                                generatedTokenForPass = uuidv4().toString().slice(29, 35);
                                let foundToken = await passes.findOne({
                                    token: generatedTokenForPass,
                                })
                                if (!foundToken) {
                                    break;
                                }
                            }
                            await passes.insertOne({
                                email: session.user.email,
                                pass_name: passMapping[payments.data.docs[i].event_name],
                                token: generatedTokenForPass,
                                banned: false,
                            })
                        }
                    } else {
                        let maheESports = payments.data.docs[i].esports;
                        if (maheESports) {
                            let esportsPassFound = await passes.findOne({
                                email: session.user.email,
                                pass_name: 'Esports',
                                banned: false,
                            });
                            if (!esportsPassFound) {
                                let generatedTokenForPass;
                                while (true) {
                                    generatedTokenForPass = uuidv4().toString().slice(29, 35);
                                    let foundToken = await passes.findOne({
                                        token: generatedTokenForPass,
                                    })
                                    if (!foundToken) {
                                        break;
                                    }
                                }
                                await passes.insertOne({
                                    email: session.user.email,
                                    pass_name: 'Esports',
                                    token: generatedTokenForPass,
                                    banned: false,
                                })
                            }
                        }
                    }
                }
                redirect(302, '/my-tickets?status=2&details=Tickets%20Generated!');
            }
        }
    }
}

async function fetchPaymentLogs(pageNumber = 1, mobileNumber) {
    const apiUrl = `https://api.manipal.edu/api/v1/falak-single-payment-log?mobile=${mobileNumber}&pageNumber=${pageNumber}`;
    const fetchedResponse = await fetch(apiUrl, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "accesskey": process.env.MANIPAL_ACCESS_KEY,
            "accesstoken": process.env.MANIPAL_ACCESS_TOKEN,
        }
    });
    return await fetchedResponse.json();
}