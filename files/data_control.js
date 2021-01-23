
module.exports = {

    // Get Data
    get: async function (patreonData) {

        let finalData = {
            campaign: {}
        };

        // Logger
        const logger = require('@tinypudding/firebase-lib/logger');

        // Build Data
        try {

            // Prepare Full Data
            const fullData = {};

            // get all the user info

            // Pledge
            finalData.currently_amount = patreonData.data.attributes.pledge_amount_cents;
            finalData.will_pay_amount = 0;
            finalData.pledge_amount = 0;

            // Get Main Data
            if (!finalData.will_pay_amount) {
                finalData.will_pay_amount = patreonData.data.attributes.will_pay_amount_cents;
            }

            if (!finalData.currently_amount) {
                finalData.currently_amount = patreonData.data.attributes.currently_entitled_amount_cents;
            }

            // Fix Data
            if (isNaN(finalData.currently_amount)) {
                finalData.currently_amount = 0;
            }

            if (isNaN(finalData.will_pay_amount)) {
                finalData.will_pay_amount = 0;
            }

            // Insert Attributes
            fullData.attributes = patreonData.data.attributes;

            // IDs
            finalData.patron_id = patreonData.data.relationships.user.data.id;
            finalData.campaign.id = patreonData.data.relationships.campaign.data.id;

            // Tiers
            fullData.tiers = {};

            // Get Full Data
            for (const item in patreonData.included) {

                // User
                if (patreonData.included[item].type === 'user' && patreonData.included[item].id === finalData.patron_id) {
                    fullData.user = patreonData.included[item].attributes;
                }

                // Campaign
                else if (patreonData.included[item].type === 'campaign' && patreonData.included[item].id === finalData.campaign.id) {
                    fullData.campaign = patreonData.included[item].attributes;
                }

                // Tier
                else if (
                    patreonData.included[item].type === 'tier' &&
                    patreonData.data.relationships.currently_entitled_tiers &&
                    Array.isArray(patreonData.data.relationships.currently_entitled_tiers.data)
                ) {

                    // Get Tier
                    for (const tier in patreonData.data.relationships.currently_entitled_tiers.data) {
                        if (patreonData.included[item].id === patreonData.data.relationships.currently_entitled_tiers.data[tier].id) {

                            // Set Data
                            fullData.tiers[patreonData.included[item].id] = patreonData.included[item].attributes;

                            // Set Main Data
                            if (fullData.tiers[patreonData.included[item].id].amount_cents > finalData.pledge_amount) {
                                finalData.pledge_amount = fullData.tiers[patreonData.included[item].id].amount_cents;
                            }

                        }
                    }

                }
            }

            // Basic Data
            finalData.patron_url = fullData.user.url;
            finalData.patron_fullname = fullData.user.full_name;

            // Campaign
            finalData.campaign.sum = fullData.campaign.pledge_sum;
            finalData.campaign.currency = fullData.campaign.currency;
            finalData.campaign.patron_count = fullData.campaign.patron_count;

            // Get Discord ID
            finalData.discord_id = fullData.user.discord_id;
            if (!finalData.discord_id && fullData.user.social_connections && fullData.user.social_connections.discord) {
                finalData.discord_id = fullData.user.social_connections.discord.user_id;
            }
            if (!finalData.discord_id && typeof finalData.discord_id !== "undefined") { delete finalData.discord_id; }

            // Get Twitch ID
            finalData.twitch = {};
            if (typeof fullData.user.twitch === "string") { finalData.twitch.username = fullData.user.twitch.split('/')[3]; }
            if (fullData.user.social_connections && fullData.user.social_connections.twitch) {
                finalData.twitch.id = fullData.user.social_connections.twitch.user_id;
            }
            if (!finalData.twitch.username && !finalData.twitch.id) {
                delete finalData.twitch;
            }

            // Get Twitter ID
            finalData.twitter = {};
            if (typeof fullData.user.twitter === "string") { finalData.twitter.username = fullData.user.twitter; }
            if (fullData.user.social_connections && fullData.user.social_connections.twitter) {
                finalData.twitter.id = fullData.user.social_connections.twitter.user_id;
            }
            if (!finalData.twitter.username && !finalData.twitter.id) {
                delete finalData.twitter;
            }

            // Get Youtube ID
            finalData.youtube = {};
            if (typeof fullData.user.youtube === "string") { finalData.youtube.username = fullData.user.youtube; }
            if (fullData.user.social_connections && fullData.user.social_connections.youtube) {
                finalData.youtube.id = fullData.user.social_connections.youtube.user_id;
            }
            if (!finalData.youtube.username && !finalData.youtube.id) {
                delete finalData.youtube;
            }

            // Get Google ID
            if (fullData.user.google_id) { finalData.google_id = fullData.user.google_id; }

            // Vanilla Data
            finalData.vanilla = fullData;

        } catch (e) {
            logger.error(e);
            finalData = null;
        }

        return finalData;

    },

    // Verify Secret Code
    verify: function (req, secretCode) {

        // https://github.com/Stonebound/patreon-to-discord-webhooks/blob/master/index.php

        const crypto = require('crypto');
        let hash = crypto
            .createHmac('md5', secretCode)
            .update(req.body)
            .digest('hex')
        let success = req.header('x-patreon-signature') === hash

        if (success) {
            return true;
        } else {
            return false;
        }

    }

}