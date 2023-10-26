let selectedMic = null;
let chunks = [];
let mediaRecorder = null;
let audioContext;
let analyser;
let dataArray;
let source;
let recordingInterval = null;
let recordingSeconds = 0;
let selectedOutput = null;
let monitorAudioInstance = null;

function populateOutputList() {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
        let outputSelect = document.getElementById("outputSelect");
        outputSelect.innerHTML = "";
        devices.forEach((device) => {
            if (device.kind === "audiooutput") {
                let option = document.createElement("option");
                option.value = device.deviceId;
                option.innerText =
                    device.label || "Saída " + (outputSelect.length + 1);
                outputSelect.appendChild(option);
            }
        });
    });
}

document.getElementById("outputSelect").addEventListener("change", (event) => {
    selectedOutput = event.target.value;
});


document.getElementById("monitorAudioButton").addEventListener("click", () => {
    if (!selectedMic) return;

    // Se já tiver uma instância de áudio para monitoramento, pare-a
    if (monitorAudioInstance) {
        monitorAudioInstance.pause();
        monitorAudioInstance = null;
    }

    let constraints = {
        audio: {
            deviceId: selectedMic
        },
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        // Crie um contexto de áudio
        let audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Crie um source node a partir do stream
        let source = audioContext.createMediaStreamSource(stream);

        // Conecte o source node ao destino (os alto-falantes)
        source.connect(audioContext.destination);

        // Crie uma instância de áudio e defina o stream como sua fonte
        monitorAudioInstance = new Audio();
        monitorAudioInstance.srcObject = stream;

        // Defina o dispositivo de saída
        if (selectedOutput) {
            monitorAudioInstance.setSinkId(selectedOutput);
        }
        
        // Comece a reproduzir o áudio em tempo real
        monitorAudioInstance.play();
    });
});


// Chamar a função para preencher a lista de saídas de áudio.
populateOutputList();

document
  .getElementById("microphoneSelect")
  .addEventListener("change", (event) => {
    selectedMic = event.target.value;
  });

document
  .getElementById("recordButton")
  .addEventListener("click", startRecording);
document.getElementById("stopButton").addEventListener("click", stopRecording);

function startAudioContext() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function populateMicrophoneList() {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    let micSelect = document.getElementById("microphoneSelect");
    micSelect.innerHTML = "";
    devices.forEach((device, index) => {
      if (device.kind === "audioinput") {
        let option = document.createElement("option");
        option.value = device.deviceId;
        option.innerText =
          device.label || "Microfone " + (micSelect.length + 1);
        micSelect.appendChild(option);

        if (index === 0) {
          selectedMic = device.deviceId;
          micSelect.value = selectedMic;
        }
      }
    });
  });
}

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    console.log("Permissão ao microfone concedida");
    populateMicrophoneList();
  })
  .catch((err) => {
    console.error("Acesso ao microfone foi negado:", err);
  });

function saveRecording(blob) {
  let transaction = db.transaction(["recordings"], "readwrite");
  let store = transaction.objectStore("recordings");
  let request = store.add(blob);

  request.onsuccess = function (event) {
    listRecordings();
  };
}

function startRecording() {
  startAudioContext();

  if (!selectedMic) return;

  let noiseReduction = document.getElementById("noiseReduction").checked;
  let echoCancellation = document.getElementById("echoCancellation").checked;

  let constraints = {
    audio: {
      deviceId: selectedMic,
      noiseSuppression: noiseReduction,
      echoCancellation: echoCancellation,
    },
  };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    mediaRecorder = new MediaRecorder(stream);
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      let blob = new Blob(chunks, { type: "audio/wav" });
      saveRecording(blob);
      chunks = [];
    };

    mediaRecorder.start();
    recordingSeconds = 0;
    recordingInterval = setInterval(updateRecordingDuration, 1000);

    updateVUMeter();

    document.getElementById("recordButton").disabled = true;
    document.getElementById("stopButton").disabled = false;
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    document.getElementById("recordButton").disabled = false;
    document.getElementById("stopButton").disabled = true;
    clearInterval(recordingInterval);
  }
}

function updateRecordingDuration() {
  recordingSeconds++;
  let minutes = Math.floor(recordingSeconds / 60);
  let seconds = recordingSeconds % 60;
  document.getElementById("recordingDuration").textContent = `${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateVUMeter() {
  requestAnimationFrame(updateVUMeter);

  analyser.getByteFrequencyData(dataArray);

  let values = dataArray.reduce((acc, value) => acc + value, 0);
  let average = values / dataArray.length;

  let dBValue = 20 * Math.log10(average);
  let normalizedValue = Math.max(0, (dBValue + 100) / 100);

  document.getElementById("vuMeter").style.height = normalizedValue * 50 + "%";
}

let db;
let request = indexedDB.open("audioRecordings", 1);

request.onerror = function (event) {
  console.error("Erro ao abrir o banco de dados.", event);
};

request.onsuccess = function (event) {
  db = event.target.result;
  listRecordings();
};

request.onupgradeneeded = function (event) {
  let db = event.target.result;
  if (!db.objectStoreNames.contains("recordings")) {
    db.createObjectStore("recordings", { autoIncrement: true });
  }
};

function listRecordings() {
  let recordingsList = document.getElementById("recordingsList");
  recordingsList.innerHTML = "";

  let transaction = db.transaction(["recordings"], "readonly");
  let store = transaction.objectStore("recordings");
  let cursorRequest = store.openCursor();

  let lastItem;

  cursorRequest.onsuccess = function (event) {
    let cursor = event.target.result;
    if (cursor) {
      let recording = cursor.value;
      let id = cursor.key;

      let listItem = document.createElement("tr");

      let nameCell = document.createElement("td");
      nameCell.textContent = "Rec" + id ;
      
      listItem.appendChild(nameCell);

      let actionCell = document.createElement("td");
      let playButton = document.createElement("button");
      let stopButton = document.createElement("button");
      let downloadButton = document.createElement("button");
      let deleteButton = document.createElement("button");
      let shareButton = document.createElement("button");

      playButton.textContent = "▶️";
      playButton.className =
        " text-gray-300 hover:bg-gray-700 mr-1 px-1 py-1 rounded";
      stopButton.textContent = "⏹️";
      stopButton.className =
        " text-gray-300 hover:bg-gray-700 mr-1 px- py-2 rounded";
      downloadButton.textContent = "Baixar";
      downloadButton.className =
        " text-gray-300 hover:bg-gray-700 mr-1 px-1 py-1 rounded";
      deleteButton.textContent = "❌";
      deleteButton.className =
        " text-gray-300 hover:bg-gray-700 px-1 py-1 rounded";

      let shareIcon = document.createElement("i");
      shareIcon.className = "fa fa-share-alt-square";
      shareIcon.setAttribute("aria-hidden", "true");

      shareButton.appendChild(shareIcon);
      shareButton.appendChild(document.createTextNode(""));
      shareButton.className =
        "border border-gray-300 text-gray-300 hover:bg-gray-700 mr-1 px-1 py-1 rounded";

      let audio;

      playButton.addEventListener("click", () => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio = new Audio(URL.createObjectURL(recording));
        playButton.disabled = true;
        playButton.textContent = "⏯";
        audio.onended = function () {
          playButton.disabled = false;
          playButton.textContent = "▶️";
        };
        audio.play();
      });

      stopButton.addEventListener("click", () => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
          playButton.disabled = false;
          playButton.textContent = "▶️";
        }
      });

      downloadButton.addEventListener("click", () => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(recording);
        a.download = "rec" + id + ".wav";
        a.click();
      });

      deleteButton.addEventListener("click", () => {
        deleteRecording(id);
      });

      shareButton.addEventListener("click", () => {
        if (navigator.share) {
          let file = new File([recording], "rec" + id + ".wav", {
            type: "audio/wav",
          });
          navigator
            .share({
              files: [file],
              title: "Compartilhar Gravação",
              text: "Aqui está a gravação que fiz. Pelo Voz Livre https://vozlivre.vercel.app/",
            })
            .catch((error) => console.error("Erro ao compartilhar:", error));
        } else {
          console.warn("Seu navegador não suporta a API Web Share.");
        }
      });

      actionCell.appendChild(playButton);
      actionCell.appendChild(stopButton);
      actionCell.appendChild(downloadButton);
      actionCell.appendChild(deleteButton);
      actionCell.appendChild(shareButton);
      listItem.appendChild(actionCell);

      
    recordingsList.appendChild(listItem);
    // Delay the application of the class to allow the CSS transition effect
    setTimeout(() => listItem.classList.add('show'), 10);
    

      lastItem = listItem;
      setTimeout(() => listItem.classList.add('show'), 20 );
      cursor.continue();
   
    } else {
      if (lastItem) {
        lastItem.classList.add("recent-item");
      }
    }
  };
}

document
  .getElementById("deleteAllButton")
  .addEventListener("click", deleteAllRecordings);

function deleteAllRecordings() {
  let transaction = db.transaction(["recordings"], "readwrite");
  let store = transaction.objectStore("recordings");
  let request = store.clear();

  request.onsuccess = function (event) {
    listRecordings();
  };
}

function deleteRecording(id) {
  let transaction = db.transaction(["recordings"], "readwrite");
  let store = transaction.objectStore("recordings");
  let getRequest = store.get(id);

  getRequest.onsuccess = function (event) {
    if (getRequest.result) {
      let deleteRequest = store.delete(id);

      deleteRequest.onsuccess = function (event) {
        listRecordings();
      };
    } else {
      console.error("Item não encontrado para o ID:", id);
    }
  };
}
