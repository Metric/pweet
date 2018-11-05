Pweet
====================
Pweet is a blockchain based microblogging service. Aka twitter but decentralized.

No coins are produced, and in order for a message to be accepted by a node. The message must first be solved by the user sending it. This is to prevent constant spamming and ensures that time was spent validating the message for the block. Each message must be signed with a signature using a Private Key. Each node validates individual messages, and thus there is no need to do any sort of mining. This allows for real time viewing. 

Blocks can store up to 2MB of messages. Which roughly equates to 2K messages per block with an average message size of 1KB. For a block to be valid, all messages must be valid and the block hash must represent all message ids + the previous block hash + previous block id + the block id. Otherwise, the block is invalid and will not be accepted by other nodes.

How is the master blockchain determined?
=======================================
Currently, the master blockchain is the longest available blockchain. Have a better idea? Let me know!

Why is an URL Used for the User Icon in Messages?
======================================
Well, do you want each message to be really large? Not really. By using just an url it helps keep the message around the 1KB mark, rather than 15KB+. 

Plus, there are plenty of image hosting services in this day and age.

How can I help?
====================
* Host a node
* Spread the word!
* Contribute via code additions and finding bugs etc.
* Feedback
* Testing

Before Boot
===============
Be sure to edit config.js file to update the address field and local address / port etc.

I Want to Host a Node
======================
Awesome! If you do let me know, so I can add it to the peers.json in this repository, or do a pull request. The address in the peers.json should be the address from your node's config.js.

The more nodes, the merrier!

I Want to Host a Private Node for my Business Only
=========================
No problem, just erase peers.json before booting up to prevent being part of the public node peers. Or, replace peers.json with your private node addresses only.

Looking for the Pweet Site / UI?
==================================
Go here: http://github.com/Metric/pweetsite

Looking for the latest version of Cuckoo-Cycle 32bit JS Library?
======================================
Go here: https://github.com/Metric/cuckoo-cycle

TODO
=================================
* Testing with actual multiple nodes (Let me know if you want to help with this!)