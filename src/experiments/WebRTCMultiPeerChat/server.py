#!/usr/bin/python -O
# -*- coding: iso-8859-15 -*-

'''
GNU GENERAL PUBLIC LICENSE

This is an example of a signaling server for a multi-party chat over WebRTC.

Copyright (C) 2014 Cristóbal Medina López.
http://www.p2psp.org

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
'''
import socket, threading, time, base64, hashlib, struct, binascii
import simplejson as json
from SimpleWebSocketServer import WebSocket, SimpleWebSocketServer

class Signaling(WebSocket):

        def handleMessage(self):
		datos=str(self.data)
		try:
		    decoded = json.loads(datos)
		except (ValueError, KeyError, TypeError):
		    print "JSON format error"

		if 'sdp' in decoded:		
			if decoded['sdp']['type'] == 'offer':
				print 'Offer'
			else:
				print 'Answer'

		if 'candidate' in decoded:
			print 'Candidate num: '+decoded['idtransmitter']

		for client in self.server.connections.itervalues():
					if client != self:
						try:
							client.sendMessage(str(self.data))
						except Exception as n:
							print n


	def handleConnected(self):
		global nextid
		print self.address, 'connected'

		try:
			self.sendMessage(str('{"numpeer":"'+str(nextid)+'"}'))
			self.sendMessage(str('{"peerlist":"'+str(peerlist)+'"}'))
			peerlist.append(nextid)
			peeridlist[nextid]=self
			nextid=nextid+1
		except Exception as n:
			print n

	def handleClose(self):
		print self.address, 'closed'
		peerlist.remove(peeridlist[self]);
		'''for client in self.server.connections.itervalues():
			if client != self:
				try:
					client.sendMessage(str(self.address[0]) + ' - disconnected')
				except Exception as n:
					print n '''       

if __name__ == '__main__':
	nextid = 0
	peerlist=[]
	peeridlist={}
	server = SimpleWebSocketServer('', 9876, Signaling)
	server.serveforever()

