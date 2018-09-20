import * as express from 'express';
import { GoogleApis } from '../googleAPI';

let router = express.Router();

router.get('/', (req, res, next) => {
    console.log("Google auth callback");
    var oauth2Client = GoogleApis.getAuthClient();
    var code = req.query.code; // the query param code
    oauth2Client.getToken(code, function(err, tokens) {
        if(!err) {
            GoogleApis.storeToken(tokens);
            res.redirect('/googleoauth/success');
        }
        else {
            console.log('Error google login. ${err}' )
        }
    });

    // Notify the bot the user is logged in
});

module.exports = router;