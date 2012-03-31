/*
 * colorPicker, JavaScript Color Picker (one-file version)
 * http://dematte.at/colorPicker
 *
 * Copyright 2011 by Peter Dematté
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * @version 0.91
 * @created 2010-11-03
 * @updated 2011-07-13
 * Date: Mon Aug 15 12:02:56 2011 -0100
 * @edited By: Girish Sharma, 2012-03-31
*/
function colorPicker(e,mode,size,rO/*readOnly*/,offsetX,offsetY,orientation,parentObj,parentXY,color,difPad,rSpeed,docBody, onColorSave, onColorChange){
  // attribute definitions
  var cP = colorPicker, // for now to make code shorter
  mode = mode||cP.mode||'B', // ['H', 'S', 'V', 'R', 'G', 'B'] initial colorMode
  size = size||cP.size||4, //[1, 2, 3, 4] initial size from XXS to L
  allowResize = rO!=null?!rO:true, //bool, allow/disallow resizing of app
  allowClose = false, //bool, allow/disallow closing of app with 'x' in right top corner
  allowDrag = rO!=null?!rO:true, //bool, allow/disallow dragging app
  expColor = rO!=null?!rO:true, //bool, switch for exporting colors to background of initial object
  expHEX = rO!=null?!rO:true, //bool, switch for exporting color-value to initial object (as value or text)
  offsetX = offsetX||cP.offsetX||0, //[int] x-offset in pixels relative to initial object
  offsetY = offsetY||cP.offsetY||3, // [int] y-offset in pixels relative to initial object
  orientation = cP.orientation||['bottom','left'], //['left||right','bottom||top'] initial xy-position relative to initial object
  parentObj = parentObj||cP.parentObj||null, // [HTMLObject] initial parent of colorPicker
  parentXY = parentXY||cP.parentXY||'', // [right:12px;top:12px] initial style (coordinates,...)
  color = color||cP.objs||[204,0,0], // initial color in common web-formats
  difPad = difPad||cP.difPad||2, // LR padding/border/left of contrast / color difference bar
  rSpeed = rSpeed!=undefined?rSpeed:cP.rSpeed!= undefined?cP.rSpeed:15, // rendering speed; 0 renders right after mousemove
  docBody = docBody||cP.docBody||document, // the element the dragEvent should be attached to [document || document.body]
  // private vars
  cP = colorPicker.cP, // collection of parts -> recycling var
  cCtr,crCtr, // current contrast, current right cursor contrast
  cPRender, // setIterval
  cPM, // picker mode [HSB or RGB]
  sX=1,sZ=1, xyzCorr, // scale for S/XS and XXS
  x,y,z, // coords for RGB color dependent on CP.mode
  difWidth, // width of contr. / color diff bar

  CP=(!cP)?function(obj) { // building the colorPicker / setting up events and methodes
    var div = document.createElementNS("http://www.w3.org/1999/xhtml", 'body'),
      cPDir = "",dC='<div class="',$='</div>',D='">'+$,
      HTMLTxt=dC+'cPSkin"><input class="cPdummy" type="" />'+dC+'cPSkinC01'+D+dC+'cPSkinC02'+D+dC+'cPSkinC03'+D+dC+'cPSkinC04'+D+dC+'cPSkinS01'+D+dC+'cPSkinS02'+D+dC+'cPSlides">'+dC+'cPSL1'+D+'<span class="cPSL2"></span><span class="cPSL3"></span>'+dC+'cPSLC'+D+'<span class="cPSL4"></span><span class="cPSR1"></span><span class="cPSR2"></span>'+dC+'cPSR3'+D+dC+'cPSRCL'+D+dC+'cPSRCR'+D+'<span class="cPSR5"></span>'+$+dC+'cPMemory">'+dC+'cPM1'+D+dC+'cPM2'+D+dC+'cPM3 ext'+D+dC+'cPM4'+D+dC+'cPM5'+D+dC+'cPM6'+D+dC+'cPM7 ext'+D+dC+'cPM8'+D+dC+'cPM9'+D+dC+'cPM0'+D+$+dC+'cPPanel">'+dC+'cPHSB">'+dC+'cPBLH bUp">H'+$+'<input type="text" name="cPIH" value="0" maxlength="3" />'+dC+'cPBRH noB">²'+$+dC+'cPBLS bUp">S'+$+'<input type="text" name="cPIS" value="0" maxlength="3" />'+dC+'cPBRS noB">%'+$+dC+'cPBLV bUp">B'+$+'<input type="text" name="cPIV" value="0" maxlength="3" />'+dC+'cPBRV noB">%'+$+$+dC+'cPRGB">'+dC+'cPBLR bUp">R'+$+'<input type="text" name="cPIR" value="0" maxlength="3" />'+dC+'cPBRR bDown"> '+$+dC+'cPBLG bUp">G'+$+'<input type="text" name="cPIG" value="0" maxlength="3" />'+dC+'cPBRG bDown"> '+$+dC+'cPBLB bDown">B'+$+'<input type="text" name="cPIB" value="0" maxlength="3" />'+dC+'cPBRB bDown"> '+$+$+dC+'cPCMYK">'+dC+'cPBLC noB">C'+$+'<input type="text" name="cPIC" value="0" readonly="readonly" />'+dC+'cPBRC noB">%'+$+dC+'cPBLM noB">M'+$+'<input type="text" name="cPIM" value="0" readonly="readonly" />'+dC+'cPBRM noB">%'+$+dC+'cPBLY noB">Y'+$+'<input type="text" name="cPIY" value="0" readonly="readonly" />'+dC+'cPBRY noB">%'+$+dC+'cPBLK noB">K'+$+'<input type="text" name="cPIK" value="100" readonly="readonly" />'+dC+'cPBRK noB">%'+$+$+dC+'cPHEX">'+dC+'cPBLX noB">#'+$+'<input type="text" name="cPIX" value="000000" maxlength="6" />'+dC+'cPBRX bUp">W'+$+$+dC+'cPCTRT'+D+dC+'cPCD'+D+dC+'cPControl">'+dC+'cPCB1 bUp'+D+dC+'cPCB2 bUp'+D+dC+'cPCB3 bUp">RES'+$+dC+'cPCB4 bUp">SAVE'+$+$+$+dC+'cPClose'+D+dC+'cPResize'+D+dC+'cPResizer">'+dC+'cPOP30'+D+$+$+'';

    // collect HTML elements
    try {
      var scriptableUnescapeHTML = Cc["@mozilla.org/feed-unescapehtml;1"].getService(Ci.nsIScriptableUnescapeHTML);
      div.appendChild(scriptableUnescapeHTML.parseFragment(HTMLTxt.replace(/src=\"/g,'src="'+cPDir), false, null, div));
    } catch (ex) {div.innerHTML = HTMLTxt.replace(/src=\"/g,'src="'+cPDir);}
    cP = colorPicker.cP = (parentObj||obj.parentNode).appendChild(div.getElementsByTagName('div')[0]);
    cP['cPSkins']=cP.style; cP.but=[];
    div = cP.all || cP.getElementsByTagName('*'); // div -> varRecycling : this happens often in my code!
    for(var n=0, nN, nB, m=0; n<div.length; n++, nN=null) { // collect references / buttons
      if (div[n].className) nN = div[n].className.replace(/(.*?)\s.*/,"$1");
      if (div[n].name) nN = div[n].name.replace(/(.*?)\s.*/,"$1");
      if (nN) {cP[nN]=div[n]; if (!div[n].name && div[n].className.search(/cP(B|P|Sl|d|Sk|RGB|HSB|CMYK|HEX|Mem|Cont|CB(3|4)|SL[2-3]|SR(1|3))/)) // this saves memory
        cP[nN+'s']=div[n].style; else if (nB = /cPB(.)(.)\s+b/.exec(div[n].className)) {cP.but[m]=[nN,nB[1],nB[2],m++]}}
    }
    // css assigning for cursor contrast change
    _bC='background-color:'; cP.CTRTop = _bC+'transparent;z-index:2'; cP.cPCD1 = _bC+'#FF9900'; cP.cPCD2 = _bC+'#44DD00';

    // add events; 100% event delegation
    cP.onmousedown = function(e){
      var e = e, obj = e.target, xy = (obj == cP.cPSL4), origin, mousePos, nCN, oCN = cP.className, nB;
      if (docBody.funcCache) stopDrag(); // just in case somebody left the browser...
      if ((!obj.name || !obj.name.search(/PI[RGBHSVX]/))) unFocus(); // to get focus off input tags
      if ((!obj.className.search(/(cP(HSB|RGB|CMYK|HEX|Panel|Skin)|(.*?\snoB))/) ||
         (obj.name && !obj.name.indexOf('cPI') && obj.readOnly)) && allowDrag) { // drag app
        mousePos = getMousePos(e,getOrigin(cP)), origin =  getOrigin(cP.parentNode);
        addEvent(docBody, 'mousemove', function(e){
          var mP = getMousePos(e,origin);
          cP.cPSkins.cssText = 'left:'+(mP[0]-mousePos[0])+'px;top:'+(mP[1]-mousePos[1])+'px';
          return false});
      } else if (obj==cP.cPResize && allowResize) { // resize app
        origin = getOrigin(cP);
        addEvent(docBody, 'mousemove', function(e){
          var mousePos = getMousePos(e,origin);
          cP.cPResizers.cssText='display:block;width:'+((mousePos[0]<3?3:mousePos[0])+5)+'px;height:'+((mousePos[1]<3?3:mousePos[1])+5)+'px';
          nCN = (mousePos[1] < 87)?' S XS XXS':(mousePos[0] < 180)?' S XS':(mousePos[0] < 275 || mousePos[1] < 175)?' S':'';
          if (cP.className != 'cPSkin' + nCN) resizeWin(nCN);
          return false});
      } else if (!obj.className.search(/cPS[L|R]/)) { // add events to slides
        if (cP.WEBS1) cP.WEBS1=null; // kill the memory of webSmart/Save button
        origin = getOrigin(obj); doDrag(e,origin,xy);
        if (xy) cP.cPSL4.className = 'cPSL4 cPSL4NC';
        addEvent(docBody, 'mousemove', function(e){doDrag(e,origin,xy);return false});
        if (rSpeed) cPRender = setInterval(function(){doRender(xy)},rSpeed); else cPRender = true;
      } else if (nB = /cPCB(\d+).*?/.exec(obj.className)) {// 4 control buttons
        if (nB[1]==1) initCp(HSV2RGB(CP.hsv[0]+(CP.hsv[0]>127.5?-127.5:127.5),CP.hsv[1],CP.hsv[2],true)); // shift color 180°
        else if (nB[1]==2) initCp(X2RGB(CP.CB2Color)); // set saved color
        else if (nB[1]==3) {cP.cPCB2s.backgroundColor='rgb('+cP.cObj.color+')'; CP.CB2Color=cP.cObj.color; CP.iCtr = getBrightness(CP.CB2Color); doRender(true,true)} // reset color 
        else {cP.cPCB2s.backgroundColor='rgb('+CP.rgbRND+')'; CP.CB2Color=CP.rgbRND; initCp(CP.rgbRND); if(onColorSave) onColorSave(CP.rgbRND);}// save color
        chBut(obj,false)
      } else if (nB = /cPB(.)(.)\s+b/.exec(obj.className)) { // all other buttons
        if(nB[1]=='L'){CP.mode=obj.className.substr(4,1); initCp(CP.rgb)} // change mode
        if(nB[1]=='R') { // buttons on right side
          if(nB[2]!='X') {nB = obj.className.substr(4,1); CP.modeRGB[nB]=!CP.modeRGB[nB]; chBut(obj,CP.modeRGB[nB]); initCp(CP.rgb)} // RGB-special buttons
          else {var r=CP.rgbRND[0], g=CP.rgbRND[1], b=CP.rgbRND[2], s=(r*(256*256)+g*256+b)%17?17:51, t=(s-1)/2; // WEB-Smart/Save button
            cP.WEBS1 = cP.WEBS1||CP.rgbRND; if (cP.cPBRX.firstChild.data == 'W') initCp(cP.WEBS1); // cP.WEBS1=null in chInput/SL|SR mousedown/init
            else {initCp([r+(r%s>t?s:0)-r%s, g+(g%s>t?s:0)-g%s, b+(b%s>t?s:0)-b%s])} chBut(obj,false)}}
      } else if (obj == cP.cPClose) {toggleCp(true); // close app
      } else if (nB = /cPM([0-9]).*/.exec(obj.className)) if (nB[1]!='0') initCp(X2RGB(obj.style.backgroundColor)); // memory squares
        else {var color = 'rgb('+CP.rgbRND+')', nB; // save color to memory squares
          for (var n=1; n<9; n++) {nB='cPM'+n+'s'; if (X2RGB(cP[nB].backgroundColor)+'' == CP.rgbRND+'') {
            cP['cPM'+n].color = color; cP[nB].backgroundColor = (getBrightness(X2RGB(color)) > 129)?'#333':'#CCC';
            cP.timeOut = setTimeout(function(){cP[nB].backgroundColor = cP['cPM'+n].color; cP.timeOut = null},200); return false}}
          if (!cP.timeOut) {for (n=9; n>1; n--) {nB='cPM'+n+'s'; cP[nB].backgroundColor = cP['cPM'+(n-1)+'s'].backgroundColor;}
          cP.cPM1s.backgroundColor = color;}}
      if (obj.name && obj.name.search(/[CMYKX]/) == -1) { // input fields as slides
        var nB = obj.name, sMax = nB.search(/[RGB]/)!=-1?255:nB.search(/[SV]/)!=-1?100:360,
            pos = nB.search(/[RH]/)!=-1?0:nB.search(/[GS]/)!=-1?1:2, delay = true, oldValue = (sMax==255) ? CP.rgb[pos] : CP.hsv[pos]/255*sMax;
        obj.className = 'cPinpDrag'; cP.inp = obj; mousePos = sMax-getMousePos(e,[0,0,0,0])[1];
        addEvent(docBody, 'mousemove', function(e){
          var mP = (!delay?oldValue:0)+sMax-getMousePos(e,[0,0,0,0])[1]-mousePos;
          if (!delay) chInput(mP,sMax,pos,CP.rgb,CP.hsv);
          else if (Math.abs(mP) > 10) { // start it all
            delay = false; mousePos += mP; obj.className = 'cPinpDragOn'; unFocus(); 
            if (rSpeed) cPRender = setInterval(function(){doRender(true,true)},rSpeed); else cPRender = true;return false}});
      } else if (obj.name); else return false; // for all others
    };

    addEvent(docBody,'mouseup',stopDrag); 

    cP.onkeydown=function(e){ // input values + arrow keys // so much code for this little job...
      var e = e, obj = e.target, obj=obj.nodeType==3?obj.parentNode:obj, code = e.keyCode, 
        code=code>=96&&code<=105?code-48:code, chr=String.fromCharCode(code), vCHR={37:1,38:1,39:1,40:1,46:1,8:1,9:1,13:1,33:1,34:1}[code], // left, up, right, down, del, back, tab, enter, pageUp, pageDown
        nB = obj.name, sMax = /[RGB]/.exec(nB)?255:/[SV]/.exec(nB)?100:/[H]/.exec(nB)?360:16777215,
        sc = sMax>360?/[0-9a-fA-F]/:/\d/, bm, sel, sleft, pos, tmpVal, valC1 = /38|40|33|34/.exec(code), valC2 = /8|46/.exec(code)||valC1;
      if (code==13) {if (obj==cP.cPIX) initCp(X2RGB(obj.value)); unFocus(); return false}
      if ((vCHR && !valC2) || (obj == cP.cPIX && (vCHR || sc.test(chr)))) return true;
      if (!nB || nB.search(/[RGBHSVX]/) == -1 || (!vCHR && !sc.test(chr))) return false; if (obj.value=='0') obj.value='';
      if (document.selection) { // IE
        bm = document.selection.createRange().getBookmark(); sel = obj.createTextRange(); sleft = obj.createTextRange();
        sel.moveToBookmark(bm); sleft.collapse(true); sleft.setEndPoint("EndToStart", sel);
        obj.selectionStart = sleft.text.length; obj.selectionEnd = sleft.text.length + sel.text.length;
      } pos = obj.selectionStart-(code==8?1:0);
      tmpVal = (obj.value.substr(0,pos)+(vCHR?'':chr)+obj.value.substr(obj.selectionEnd+(code==46?1:0))).replace(/^0*/g,'');
      if (valC1) tmpVal = +obj.value+(code==38?1:code==40?-1:code==33?(tmpVal>(sMax-10)?sMax-tmpVal:10):-10); obj.value = tmpVal;
      if (+tmpVal <= sMax) chInput(+tmpVal,sMax,nB.search(/[RH]/)!=-1?0:nB.search(/[GS]/)!=-1?1:2,CP.rgb,CP.hsv); if (rSpeed) doRender(true,true);
      pos = pos-(valC2?1:0);
      if(obj.createTextRange) {bm = obj.createTextRange();bm.move("character", pos+1);bm.select()} else obj.setSelectionRange(pos+1, pos+1);
      return false;
    };

    cP.onmouseup = cP.cPPanel.onmouseout = function(e){ // reset all button states
      var e = e, obj = e.target;
      if (!obj.className.search(/cPC*B(\d|RX)/) && !cPRender) chBut(obj,true);
      return false;
    };

    cP.ondblclick=function(e){
      var e = e, obj = e.target, nB = /cPB(.)(.)\s+b/.exec(obj.className);
      if (nB && nB[2]!='X'&& nB[1]!='R' && sX>1) {CP.mode=nB[2]=='H'?'R':nB[2]=='S'?'G':nB[2]=='V'?'B':nB[2]=='R'?'H':nB[2]=='G'?'S':'V';initCp(CP.rgb);resizeWin(' S')} // change mode if small
    };

    // method definitions
    colorPicker.importRGB = function(rgb) { var pos, CP=colorPicker.CP; if(rgb[0]===false) rgb[0]=CP.rgb[0]; else pos=0; if(rgb[1]===false) rgb[1]=CP.rgb[1]; else pos=1; if(rgb[2]===false) rgb[2]=CP.rgb[2]; else pos=2;
      chInput(rgb[pos],255,pos,rgb,CP.hsv);
      if (!rSpeed) doRender(true,true); else if (!cPRender)cPRender = setInterval(function(){doRender(true,true)},rSpeed)};
    colorPicker.importHSB = function(hsv) { var pos, sMax, CP=colorPicker.CP; if(hsv[0]===false) hsv[0]=CP.hsv[0]; else {pos=0; sMax=360}; if(hsv[1]===false) hsv[1]=CP.hsv[1]; else {pos=1; sMax=100}; if(hsv[2]===false) hsv[2]=CP.hsv[2]; else {pos=2; sMax=100};
      chInput(hsv[pos],sMax,pos,CP.rgb,hsv);
      if (!rSpeed) doRender(true,true); else if (!cPRender)cPRender = setInterval(function(){doRender(true,true)},rSpeed)};
    colorPicker.importColor = function(color) {initCp(X2RGB(color))};
    colorPicker.stopRendering = function() {clearInterval(cPRender); cPRender=false; doRender(true,true)};

    scripts=div=n=m=cPDir=nN=nB=HTMLTxt=null;
    CP=colorPicker.CP={}; CP.modeRGB={}; CP.mode=colorPicker.mode||mode; colorPicker.rSpeed=rSpeed;
  }:colorPicker.CP, // collection of colors/coords

  initCp = function(rgb) {
    cPM = /R|G|B/.exec(CP.mode)?'RGB':'HSV';
    x=/R|G/.exec(CP.mode)?2:CP.mode=='H'?1:0;
    y=/S|H/.exec(CP.mode)?2:CP.mode=='G'?0:1;
    z=/R|H/.exec(CP.mode)?0:/G|S/.exec(CP.mode)?1:2;

    if (!allowResize) cP.cPResizes.display='none'; if (!allowClose) cP.cPCloses.display='none';
    sX=/cPSkin(\s+S)*(\s+XS)*(\s+XXS)*/.exec(cP.className); sZ=sX[3]?2:1; sX=sX[1]?2:1; xyzCorr=(sX>1?128:0)+(sZ>1?64:0); // reset size and size correction
    for(var n=0; n<cP.but.length; n++) if (cP.but[n][1] == 'L') chBut(cP[cP.but[n][0]],cP.but[n][2] != CP.mode); // reset button states
    for(var n=0,nob='RGB'.split('');n<nob.length;n++) if (CP.modeRGB[nob[n]]) cP['cPBR'+nob[n]].className = 'cPBR'+nob[n]+' '+'bUp';
    difWidth = getStyle(cP.cPCTRT.parentNode,'width').replace('px','')-difPad; // max width of contrast/color bar
    CP.iCtr = getBrightness(CP.CB2Color); cCtr=null; crCtr=null;// of the current saved color !!!
    cP.cPCB2s.backgroundColor = 'rgb('+CP.CB2Color+')'; // set right swatch
    rSpeed = colorPicker.rSpeed;
    for(var n=1, m='L';n<=3;n++) { // preset all classNames in all sliders
      cP['cPS'+m+n].className = 'cPS'+m+n+CP.mode+(CP.modeRGB[CP.mode]&&n>1&&m=='R'?' cPhide':'');
      if (n>2 && m=='L') {m='R'; n=0}}
    CP.rgb=[]; CP.hsv=[]; if (cPM == 'HSV') rgb = RGB2HSV(rgb[0],rgb[1],rgb[2]);
    doDrag(null,null,true,[rgb[x],rgb[y],rgb[z]],true);
  },

  doDrag = function(e,origin,xy,mouseIs,render,rgb,hsv) { // this func gets/stores mouse coordinates and calculates all colors
    var CP=colorPicker.CP, xyz;
    if (!mouseIs){ // correct mousepos to stay inside boundries
      xyz = getMousePos(e,origin);
      xyz[1] = xyz[1]<0?255:xyz[1]*sX*sZ>255?0:255-xyz[1]*sX*sZ;
      if (xy) {CP.xyz[0] = xyz[0]<0?0:xyz[0]*sX>255?255:xyz[0]*sX; CP.xyz[1] = xyz[1]} else CP.xyz[2] = xyz[1]; //; s+=6}
    } else CP.xyz=mouseIs;// { s=(s-2)/2+38}

    if (cPM == 'RGB')  { // store colors
      if (rgb) CP.rgb = rgb; else {CP.rgb[x] = CP.xyz[0]; CP.rgb[y] = CP.xyz[1]; CP.rgb[z] = CP.xyz[2]}
      CP.hsv = hsv?hsv:RGB2HSV(CP.rgb[0],CP.rgb[1],CP.rgb[2]);
    } else {
      if (hsv) CP.hsv = hsv; else {CP.hsv[x] = CP.xyz[0]; CP.hsv[y] = CP.xyz[1]; CP.hsv[z] = CP.xyz[2]}
      CP.rgb = rgb?rgb:HSV2RGB(CP.hsv[0],CP.hsv[1],CP.hsv[2], true);
    }
    CP.rgbRND = [Math.round(CP.rgb[0]),Math.round(CP.rgb[1]),Math.round(CP.rgb[2])];
    CP.cmyk = RGB2CMYK(CP.rgb[0],CP.rgb[1],CP.rgb[2]); CP.cmyk = [Math.round(CP.cmyk[0]*100),Math.round(CP.cmyk[1]*100),Math.round(CP.cmyk[2]*100),Math.round((1-CP.cmyk[3])*100)];
    CP.hex = RGB2HEX(CP.rgbRND[0],CP.rgbRND[1],CP.rgbRND[2]);

    if (onColorChange) onColorChange([CP.rgbRND, CP.cmyk, CP.hex]);
    if (!rSpeed || render) doRender(xy,mouseIs);
  },

  doRender = function(xy,yz) { // function for pure rendering. No rendering elsewhere!!
    var CP=colorPicker.CP,cP=colorPicker.cP,a=0,b=0,c=0,ctrDif,colDif,tmpHSV,nCtr,nrCtr,cPCtr, WS; // cP & CP = scope shifting

    // display all the nice colors in sliders
    if (xy) { // left slider -> right
      if (CP.xyz[0] > CP.xyz[1]) b=1; else a=1;
      if (CP.mode == 'S' || CP.mode == 'V') {cP.cPSR2s.backgroundColor = 'rgb('+HSV2RGB(CP.xyz[0],255,255)+')'; b=1; c=255}
      else if (CP.mode != 'H' && !CP.modeRGB[CP.mode]) cP.cPSR2.className = 'cPSR'+(2+a)+CP.mode+' cPOP'+Math.round((CP.xyz[a]-CP.xyz[b])/(255-CP.xyz[b])*100 || 0);
      if (CP.mode != 'H' && !CP.modeRGB[CP.mode]) cP.cPSR3.className = 'cPSR4'+CP.mode+' cPOP'+Math.round(Math.abs(c-CP.xyz[b])/2.55);
      cP.cPSLCs.cssText = 'left:'+(CP.xyz[0]/sX-5)+'px;top:'+Math.ceil(250-CP.xyz[1]/sX/sZ-xyzCorr)+'px'; // change cursor
    }
    if (!xy || yz) { // right slider -> left
      if (CP.mode == 'H') {tmpHSV = HSV2RGB(CP.xyz[2],255,255); cP.cPSL1s.backgroundColor = 'rgb('+tmpHSV+')'}
      else cP.cPSL3.className = 'cPSL3'+CP.mode+' cPOP'+(100-Math.round(CP.xyz[2]/2.55));
      cP.cPSRCLs.top = c = +Math.ceil(252-CP.xyz[2]/sX/sZ-xyzCorr)+'px'; // change right-left cursor ... recycle var c
      if (yz) cP.cPSRCRs.top = c; // change right-right cursor
    }

    // switch brightness if contrast changes
    cPCtr = getBrightness(CP.rgbRND); nCtr = cPCtr > 128;
    if (cCtr !== nCtr) {
      if (nCtr) {if (expColor) cP.cObjs.color = '#222'; cP.cPSLC.className = 'cPSLCB'; CP.cPM0CN = 'cPM0 cPM0B';
        if (CP.mode != 'H' && !CP.modeRGB[CP.mode]) {cP.cPSRCL.className = 'cPSRCLB';
          if (xy) cP.cPSRCR.className = 'cPSRCRB'}
      } else {if (expColor) cP.cObjs.color = '#ddd';cP.cPSLC.className = 'cPSLCW'; CP.cPM0CN = 'cPM0';
        if (CP.mode != 'H' && !CP.modeRGB[CP.mode]) {cP.cPSRCL.className = 'cPSRCLW';
          if (xy) cP.cPSRCR.className = 'cPSRCRW'}
      }
    } cCtr = nCtr;
    if (!xy || yz) { // only right
      if (CP.modeRGB[CP.mode]) {
        nrCtr = CP.xyz[2] > 153;
        if (crCtr !== nrCtr){ // RGB special mode
          if (nrCtr && CP.mode == 'G') {cP.cPSRCL.className = 'cPSRCLB'; if (xy) cP.cPSRCR.className = 'cPSRCRB'; 
          } else {cP.cPSRCL.className = 'cPSRCLW'; if (xy) cP.cPSRCR.className = 'cPSRCRW'}}
      } else if (CP.mode == 'H') { // HSB_H mode extra rules
        nrCtr = getBrightness(tmpHSV || HSV2RGB(CP.hsv[0],255,255)) > 128;
        if (crCtr !== nrCtr) {if (nrCtr) cP.cPSRCL.className = 'cPSRCLB'; else cP.cPSRCL.className = 'cPSRCLW'}
      } crCtr = nrCtr;
    }

    // display brightness/color match bar
    colDif = getColorDifference(CP.CB2Color,CP.rgb)/765*difWidth; // 765 = 3 colors * 255 possible values
    ctrDif = Math.abs((cPCtr-CP.iCtr)/255*difWidth);
    cP.cPCTRTs.cssText = 'width:'+ctrDif+'px;'+((colDif>ctrDif)?cP.CTRTop:'');
    cP.cPCDs.cssText = 'width:'+colDif+'px;'+((ctrDif<difWidth/2 && colDif<difWidth/3*2)?'':((ctrDif<difWidth/2 || colDif<difWidth/3*2)?cP.cPCD1:cP.cPCD2));

    // display color values // this also touches the DOM
    cP.cPIR.value = CP.rgbRND[0]; cP.cPIG.value = CP.rgbRND[1]; cP.cPIB.value = CP.rgbRND[2];
    cP.cPIH.value = Math.round(CP.hsv[0]/255*360); cP.cPIS.value = Math.round(CP.hsv[1]/2.55); cP.cPIV.value = Math.round(CP.hsv[2]/2.55);
    cP.cPIC.value = CP.cmyk[0]; cP.cPIM.value = CP.cmyk[1]; cP.cPIY.value = CP.cmyk[2]; cP.cPIK.value = CP.cmyk[3];
    cP.cPIX.value = CP.hex;

    // display WEBSave/WEBSmart/otherColor button
    WS = (CP.rgbRND[0]%51==0 && CP.rgbRND[1]%51==0 && CP.rgbRND[2]%51==0) ? 'W' :
         (CP.rgbRND[0]%17==0 && CP.rgbRND[1]%17==0 && CP.rgbRND[2]%17==0) ? 'M' : '!';
    if (WS != CP.WS) cP.cPBRX.firstChild.data = CP.WS = WS;

    // display value/color in initField swatch and left/background
    cP.cPCB1s.backgroundColor = 'rgb('+CP.rgbRND+')';
    if (CP.bd) docBody.style.background = 'rgb('+CP.rgbRND+')';

    if (colorPicker.exportColor) colorPicker.exportColor();
    if (xy && yz) { // stopRender
      cP.cPSRCR.className = cP.cPSRCL.className.replace('L','R'); // ;o)
      cP.cPM0s.backgroundColor = 'rgb('+CP.rgbRND+')';
      if (CP.cPM0CN) {cP.cPM0.className = CP.cPM0CN; CP.cPM0CN = ''}
    }
  },

  stopDrag = function(){
    removeEvent(docBody, 'mousemove');
    if (cPRender){clearInterval(cPRender); cPRender=false; doRender(true,true)}
    cP.cPSL4.className = 'cPSL4'; // cursor to normal
    cP.cPResizers.cssText='';
    try {
      cP.cObj.osX = cP.style.left; cP.cObj.osY = cP.style.top; // save position
    } catch(ex) {}
    if (cP.inp) cP.inp.className = '';
  },

  chInput = function(mP,sMax,pos,rgb,hsv) {
    if (cP.WEBS1) cP.WEBS1=null; // kill the memory of webSmart/Save button
    mP = (mP<0)?0:(mP>sMax)?sMax:mP;
    if (sMax == 255) {rgb[pos] = mP; if (cPM == 'HSV') hsv=RGB2HSV(rgb[0],rgb[1],rgb[2])}
    else {hsv[pos] = mP/sMax*255; if (cPM == 'RGB') rgb=HSV2RGB(hsv[0],hsv[1],hsv[2])};
    if (cPM == 'RGB') doDrag(null,null,rSpeed==0,[rgb[x],rgb[y],rgb[z]],false,rgb,(sMax != 255)?hsv:false);
    else doDrag(null,null,rSpeed==0,[hsv[x],hsv[y],hsv[z]],false,(sMax == 255)?rgb:false,hsv)
  },

  chBut = function(obj,onOff) {obj.className = (onOff) ? obj.className.replace('bDown','bUp') : obj.className.replace('bUp','bDown')},

  resizeWin = function(nCN) {
    cP.className = 'cPSkin' + nCN; sX=(nCN)?2:1; sZ=(nCN==' S XS XXS')?2:1; xyzCorr=(sX>1?128:0)+(sZ>1?64:0);
    if (nCN==' S XS XXS' && (cPM=='RGB' || CP.mode=='H')) {CP.modeTmp=CP.mode; CP.mode='S'; initCp(CP.rgb)}
    else if (CP.modeTmp && CP.modeTmp!=CP.mode) {CP.mode=CP.modeTmp; CP.modeTmp=null; initCp(CP.rgb)} else doRender(true,true);
    cP.cPRGB.className = (cPM=='RGB' || !nCN) ? 'cPRGB' : 'cPhide'; cP.cPHSB.className = (cPM=='HSV' || !nCN) ? 'cPHSB' : 'cPhide';
  },

  toggleCp = function(onOff,obj) {
    var cPPS;
    if (onOff && !parentObj) cP.cPSkins.display = 'none';
    else {if (!parentObj) {
        if (cP.cObj && obj.parentNode != cP.cObj.parentNode) obj.parentNode.appendChild(cP.parentNode.removeChild(cP));
        cPPS = cP.parentNode.style;
        if (getStyle(cP.parentNode,'position') == 'static') cPPS.position = 'relative'; // fixed???
        if (!/(display|height|width|zoom)/.exec(cPPS.cssText.toLowerCase())) cPPS.zoom = '1'}
      if (parentObj) cP.cPSkins.cssText = cP.cPSkins.cssText.replace(parentXY,'') + parentXY;
      else {
        cP.cPSkins.position = 'absolute'; cP.cPSkins.display = '';
        cP.cPSkins.left = (obj.osX?obj.osX:(obj.offsetLeft+offsetX+(orientation[1]=='right'?obj.offsetWidth:0))+'px');
        cP.cPSkins.top =  (obj.osY?obj.osY:(obj.offsetTop-(orientation[0]=='top'?cP.offsetHeight-(orientation[1]=='right'?obj.offsetHeight:-offsetY):orientation[1]=='right'?obj.offsetHeight-obj.offsetHeight:-offsetY-obj.offsetHeight))+'px')}
      cP.cObj = obj; initCp(CP.CB2Color)
    }
  },

  unFocus = function() {cP.cPdummy.focus();},

  /* ------  my nice helpers -------- */

  getBrightness = function(rgb) {return Math.sqrt(rgb[0]*rgb[0]*.241+rgb[1]*rgb[1]*.691+rgb[2]*rgb[2]*.068)},

  getColorDifference = function(rgb1,rgb2) {
    return (Math.max(rgb1[0], rgb2[0]) - Math.min(rgb1[0], rgb2[0])) +
           (Math.max(rgb1[1], rgb2[1]) - Math.min(rgb1[1], rgb2[1])) +
           (Math.max(rgb1[2], rgb2[2]) - Math.min(rgb1[2], rgb2[2]));
  },

  X2RGB = function (hex) { // accepts array(r,g,b), 'rgb(r,g,b)', #0 - #123AEFxyz, 0 - 123AEFxyz, #2af, 2af
    hex = (hex+'').replace(/[(^rgb\()]*[^a-fA-F0-9,]*/g,'').split(',');
    if (hex.length == 3) return [+hex[0],+hex[1],+hex[2]];
    hex+=''; if (hex.length == 3) {hex=hex.split(''); return [parseInt((hex[0]+hex[0]),16),parseInt((hex[1]+hex[1]),16),parseInt((hex[2]+hex[2]),16)]}
    while(hex.length<6) hex='0'+hex; return [parseInt(hex.substr(0,2),16),parseInt(hex.substr(2,2),16),parseInt(hex.substr(4,2),16)]
  },

  RGB2HEX = function (r,g,b) {
    return((r<16?'0':'')+r.toString(16)+
           (g<16?'0':'')+g.toString(16)+
           (b<16?'0':'')+b.toString(16)).toUpperCase();
  },

  HSV2RGB = function(x,y,z,s) { // !!! this function takes x,y,z not h,s,v
    var r=0, g=0, b=0, c=0, d=(100-y/2.55)/100, i=z/255,j=z*(255-y)/255;

    if (x<42.5){r=z;g=x*6*i;g+=(z-g)*d;b=j}
    else if (x>=42.5&&x< 85){c=42.5;r=(255-(x-c)*6)*i;r+=(z-r)*d;g=z;b=j}
    else if (x>=85&&x<127.5){c=85;r=j;g=z;b=(x-c)*6*i;b+=(z-b)*d}
    else if (x>=127.5&&x<170){c=127.5;r=j;g=(255-(x-c)*6)*i;g+=(z-g)*d;b=z}
    else if (x>=170&&x<212.5){c=170;r=(x-c)*6*i;r+=(z-r)*d;g=j;b=z}
    else if (x>=212.5){c=212.5;r=z;g=j;b=(255-(x-c)*6)*i;b+=(z-b)*d}
    if (s) return[r,g,b]; else return [Math.round(r),Math.round(g),Math.round(b)];
  },

  RGB2HSV = function(r,g,b) { // !!! this function returns x,y,z not h,s,v
    var n = Math.min(Math.min(r,g),b), v = Math.max(Math.max(r,g),b), m = v - n, h = 0;
    if(m === 0) return [0, 0, v];
    h = r===n ? 3+(b-g)/m : (g===n ? 5+(r-b)/m : 1+(g-r)/m);
    return [h===6?0:h*42.5, m/v*255, v];
  },

  RGB2CMYK = function(r,g,b) {
    var k = Math.min(1-r,1-g,1-b), l = 1-k;
    if (k == 1) return[0,0,0,-k/255];
    else return[(1-r-k)/l,(1-g-k)/l,(1-b-k)/l,-k/255];
  },

  getStyle = function (obj,prop) { // simple version
    if (obj.currentStyle)  return obj.currentStyle[prop];
    else if (window.getComputedStyle) return document.defaultView.getComputedStyle(obj,null).getPropertyValue(prop);
  },

  getOrigin = function(obj) {
    var parent=null, box=null, pos=[],
      _sL = docBody.scrollLeft+document.documentElement.scrollLeft,
      _sT = docBody.scrollTop+document.documentElement.scrollTop;

    if (obj.parentNode === null || getStyle(obj,'display') == 'none') return false;
    if (obj.getBoundingClientRect) { // IE
      box = obj.getBoundingClientRect();
      return [Math.round(box.left)+(document.documentElement.scrollLeft||docBody.scrollLeft),
              Math.round(box.top)+(document.documentElement.scrollTop||docBody.scrollTop),_sL,_sT];
    } else if (document.getBoxObjectFor) { // gecko
      box = document.getBoxObjectFor(obj);
      pos = [box.x, box.y];
    }
    if (obj.parentNode) parent = obj.parentNode; else parent = null;
    while (parent && parent.tagName != 'BODY' && parent.tagName != 'HTML') {
      pos[0] -= parent.scrollLeft;
      pos[1] -= parent.scrollTop;
      if (parent.parentNode) parent = parent.parentNode;
      else parent = null;
    }
    return pos.concat([_sL,_sT]);
  },

  getMousePos = function(e,xy) {
    getMousePos = (typeof e.pageX === 'number') ?
      function(e,xy) {return [e.pageX-xy[0],e.pageY-xy[1]]} :
      function(e,xy) {return [e.clientX+xy[2]-xy[0],e.clientY+xy[3]-xy[1]]};
    return getMousePos(e,xy);
  },

  addEvent = function(obj, type, func) {
    if (!obj || !type || !func) return false;
    obj.funcCache = obj.funcCache || {};
    obj.funcCache[type] = func;
    obj.addEventListener(type, func, false);
  },
  
  removeEvent = function(obj, type, func) {
    if (!obj || !type) return false;
    if (!func && (!obj.funcCache || !obj.funcCache[type])) return false;
    obj.removeEventListener(type, func||obj.funcCache[type], false);
  };

  (function() {
    var obj = parentObj || e.target, n, c;
      if (!cP) {CP(obj); e=false}
      CP.CB2Color = obj.color = X2RGB(obj.value||color||[204,0,0]);
      if (cP.WEBS1) cP.WEBS1=null; // kill the memory of webSmart/Save button
      cP.cObjs = obj.style;
      if (obj.value) CP.valPrefix = /(#*)/.exec(obj.value)[0]; else CP.valPrefix = '#'; // wether you have an # or an ## (Cold Fusion) or none
      toggleCp(cP.cPSkins.display == '' && obj == cP.cObj ? true : false, obj);
      if (!e) resizeWin(size==1?' S XS XXS':size==2?' S XS':size==3?' S':'');
  })();
}